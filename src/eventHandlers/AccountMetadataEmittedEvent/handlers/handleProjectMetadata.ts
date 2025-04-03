/* eslint-disable no-param-reassign */
import type { Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { z } from 'zod';
import {
  AccountMetadataEmittedEventModel,
  DripListSplitReceiverModel,
  GitProjectModel,
} from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../core/LogManager';
import { calculateProjectStatus } from '../../../utils/gitProjectUtils';
import type { IpfsHash, RepoDriverId } from '../../../core/types';
import { DependencyType } from '../../../core/types';
import {
  assertAddressDiverId,
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../../utils/accountIdUtils';
import unreachableError from '../../../utils/unreachableError';
import { getProjectMetadata } from '../../../utils/metadataUtils';
import verifySplitsReceivers from '../verifySplitsReceivers';
import { isLatestEvent } from '../../../utils/eventUtils';
import { verifyProjectMetadata } from '../projectVerification';
import {
  createAddressReceiver,
  createProjectAndProjectReceiver,
  deleteExistingReceivers,
} from '../receiversRepository';
import type {
  addressDriverSplitReceiverSchema,
  repoDriverSplitReceiverSchema,
} from '../../../metadata/schemas/repo-driver/v2';

type Params = {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  logManager: LogManager;
  projectId: RepoDriverId;
  transaction: Transaction;
  originEventDetails: {
    entity: AccountMetadataEmittedEventModel;
    logIndex: number;
    transactionHash: string;
  };
};

export default async function handleGitProjectMetadata({
  ipfsHash,
  logManager,
  projectId,
  transaction,
  blockTimestamp,
  originEventDetails: { entity, logIndex, transactionHash },
}: Params) {
  // Only process metadata if this is the latest event.
  if (
    !(await isLatestEvent(
      entity,
      AccountMetadataEmittedEventModel,
      {
        logIndex,
        transactionHash,
        accountId: projectId,
      },
      transaction,
    ))
  ) {
    logManager.logAllInfo();

    return;
  }
  logManager.appendIsLatestEventLog();

  const project = await GitProjectModel.findByPk(projectId, {
    transaction,
    lock: true,
  });

  if (!project) {
    throw new Error(
      [
        `Failed to update metadata for Project ${projectId}: Project not found.`,
        `Possible reasons:`,
        `  - The event that should have created the Project hasn't been processed yet.`,
        `  - Metadata was manually emitted for a Project that doesn't exist in the system.`,
      ].join('\n'),
    );
  }

  const metadata = await getProjectMetadata(ipfsHash);

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await verifySplitsReceivers(
      project.id,
      metadata.splits.dependencies
        .concat(metadata.splits.maintainers as any)
        .map((s) => ({
          weight: s.weight,
          accountId: s.accountId,
        })),
    );

  if (!areSplitsValid) {
    logManager.appendLog(
      [
        `Skipping metadata update for Project ${projectId} due to mismatch in splits hash.`,
        `  On-chain hash: ${onChainSplitsHash}`,
        `  Metadata hash: ${calculatedSplitsHash}`,
        `  Possible causes:`,
        `    - The metadata event is the latest in the DB, but not on-chain.`,
        `    - The metadata was manually emitted with outdated or mismatched splits.`,
      ].join('\n'),
    );

    return;
  }

  await verifyProjectMetadata(project, metadata);

  await updateProjectMetadata(
    project,
    logManager,
    transaction,
    metadata,
    ipfsHash,
  );

  await deleteExistingReceivers({
    for: {
      accountId: projectId,
      column: 'funderProjectId',
    },
    transaction,
  });

  await setNewReceivers(
    projectId,
    metadata.splits,
    logManager,
    transaction,
    blockTimestamp,
  );
}

async function updateProjectMetadata(
  project: GitProjectModel,
  logManager: LogManager,
  transaction: Transaction,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
  metadataIpfsHash: IpfsHash,
): Promise<void> {
  const { color, source, description } = metadata;

  project.color = color;
  project.url = source.url;
  project.description = description ?? null;
  project.verificationStatus = calculateProjectStatus(project);
  project.isVisible = 'isVisible' in metadata ? metadata.isVisible : true; // Projects without `isVisible` field (V4 and below) are considered visible by default.
  project.lastProcessedIpfsHash = metadataIpfsHash;

  if ('avatar' in metadata) {
    // Metadata V4

    if (metadata.avatar.type === 'emoji') {
      project.emoji = metadata.avatar.emoji;
      project.avatarCid = null;
    } else if (metadata.avatar.type === 'image') {
      project.avatarCid = metadata.avatar.cid;
      project.emoji = null;
    }
  } else {
    // Metadata V3

    project.emoji = metadata.emoji;
  }

  logManager.appendUpdateLog(project, GitProjectModel, project.id);

  await project.save({ transaction });
}

async function setNewReceivers(
  funderProjectId: RepoDriverId,
  receivers: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'],
  logManager: LogManager,
  transaction: Transaction,
  blockTimestamp: Date,
) {
  const { dependencies, maintainers } = receivers;

  const maintainerPromises = maintainers.map((maintainer) => {
    assertAddressDiverId(maintainer.accountId);

    return createAddressReceiver({
      logManager,
      transaction,
      blockTimestamp,
      metadataReceiver: maintainer as z.infer<
        typeof addressDriverSplitReceiverSchema
      >,
      funder: {
        type: 'project',
        accountId: funderProjectId,
        dependencyType: 'maintainer',
      },
    });
  });

  const dependencyPromises = dependencies.map(async (dependency) => {
    if (isRepoDriverId(dependency.accountId)) {
      return createProjectAndProjectReceiver({
        logManager,
        transaction,
        blockTimestamp,
        metadataReceiver: dependency as z.infer<
          typeof repoDriverSplitReceiverSchema
        >, // Safe to cast because we already checked the type of accountId.
        funder: {
          type: 'project',
          accountId: funderProjectId,
        },
      });
    }

    if (isAddressDriverId(dependency.accountId)) {
      return createAddressReceiver({
        logManager,
        transaction,
        blockTimestamp,
        metadataReceiver: dependency as z.infer<
          typeof addressDriverSplitReceiverSchema
        >, // Safe to cast because we already checked the type of accountId.
        funder: {
          type: 'project',
          accountId: funderProjectId,
          dependencyType: 'dependency',
        },
      });
    }

    if (isNftDriverId(dependency.accountId)) {
      return DripListSplitReceiverModel.create(
        {
          funderProjectId,
          fundeeDripListId: dependency.accountId,
          weight: dependency.weight,
          type: DependencyType.ProjectDependency,
          blockTimestamp,
        },
        { transaction },
      );
    }

    return unreachableError(
      `Dependency with account ID ${dependency.accountId} is not an Address nor a Project.`,
    );
  });

  const result = await Promise.all([
    ...maintainerPromises,
    ...dependencyPromises,
  ]);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(
      GitProjectModel,
    )} with ID ${funderProjectId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
  );
}
