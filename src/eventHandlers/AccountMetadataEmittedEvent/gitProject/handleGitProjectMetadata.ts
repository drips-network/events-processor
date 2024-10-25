/* eslint-disable no-param-reassign */
import type { Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import {
  AddressDriverSplitReceiverModel,
  DripListSplitReceiverModel,
  GitProjectModel,
  RepoDriverSplitReceiverModel,
} from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../core/LogManager';
import { calculateProjectStatus } from '../../../utils/gitProjectUtils';
import {
  DependencyType,
  type IpfsHash,
  type ProjectId,
} from '../../../core/types';
import {
  assertAddressDiverId,
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../../utils/accountIdUtils';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import { assertDependencyOfProjectType } from '../../../utils/assert';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import unreachableError from '../../../utils/unreachableError';
import { getProjectMetadata } from '../../../utils/metadataUtils';
import validateProjectMetadata from './validateProjectMetadata';
import validateSplitsReceivers from '../splitsValidator';
import getUserAddress from '../../../utils/getAccountAddress';

export default async function handleGitProjectMetadata(
  logManager: LogManager,
  projectId: ProjectId,
  transaction: Transaction,
  ipfsHash: IpfsHash,
  blockTimestamp: Date,
) {
  const project = await GitProjectModel.findByPk(projectId, {
    transaction,
    lock: true,
  });

  if (!project) {
    throw new Error(
      `Failed to update metadata for Project with ID ${projectId}: Project not found.
      \r Possible reasons:
      \r\t - The event that should have created the Project was not processed yet.
      \r\t - The metadata were manually emitted for a Project that does not exist in the app.`,
    );
  }

  const metadata = await getProjectMetadata(ipfsHash);

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await validateSplitsReceivers(
      project.id,
      metadata.splits.dependencies
        .concat(metadata.splits.maintainers as any)
        .map((s) => ({
          weight: s.weight,
          accountId: s.accountId,
        })),
    );

  // If we reach this point, it means that the processed `AccountMetadataEmitted` event is the latest in the DB.
  // But we still need to check if the splits are the latest on-chain.
  // There is no need to process the metadata if the splits are not the latest on-chain.

  if (!areSplitsValid) {
    logManager.appendLog(
      `Skipping metadata update for Project with ID ${projectId} because the splits receivers hashes from the contract and the metadata do not match:
      \r\t - On-chain splits receivers hash: ${onChainSplitsHash}
      \r\t - Metadata splits receivers hash: ${calculatedSplitsHash}
      \r Possible reasons:
      \r\t - The metadata were the latest in the DB but not on-chain.
      \r\t - The metadata were manually emitted with different splits than the latest on-chain.`,
    );

    return;
  }

  await validateProjectMetadata(project, metadata);

  await updateGitProjectMetadata(project, logManager, transaction, metadata);

  await createDbEntriesForProjectSplits(
    projectId,
    metadata.splits,
    logManager,
    transaction,
    blockTimestamp,
  );
}

async function updateGitProjectMetadata(
  project: GitProjectModel,
  logManager: LogManager,
  transaction: Transaction,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): Promise<void> {
  const { color, source, description } = metadata;

  project.color = color;
  project.url = source.url;
  project.description = description ?? null;
  project.verificationStatus = calculateProjectStatus(project);
  project.isVisible = 'isVisible' in metadata ? metadata.isVisible : true; // Projects without `isVisible` field (V4 and below) are considered visible by default.

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

async function createDbEntriesForProjectSplits(
  funderProjectId: ProjectId,
  splits: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'],
  logManager: LogManager,
  transaction: Transaction,
  blockTimestamp: Date,
) {
  await clearCurrentProjectSplits(funderProjectId, transaction);

  const { dependencies, maintainers } = splits;

  const maintainerPromises = maintainers.map((maintainer) => {
    assertAddressDiverId(maintainer.accountId);

    return AddressDriverSplitReceiverModel.create(
      {
        funderProjectId,
        weight: maintainer.weight,
        fundeeAccountId: maintainer.accountId,
        fundeeAccountAddress: getUserAddress(maintainer.accountId),
        type: AddressDriverSplitReceiverType.ProjectMaintainer,
        blockTimestamp,
      },
      { transaction },
    );
  });

  const dependencyPromises = dependencies.map(async (dependency) => {
    if (isRepoDriverId(dependency.accountId)) {
      assertDependencyOfProjectType(dependency);

      return createDbEntriesForProjectDependency(
        funderProjectId,
        dependency,
        transaction,
        blockTimestamp,
      );
    }

    if (isAddressDriverId(dependency.accountId)) {
      return AddressDriverSplitReceiverModel.create(
        {
          funderProjectId,
          weight: dependency.weight,
          fundeeAccountId: dependency.accountId,
          fundeeAccountAddress: getUserAddress(dependency.accountId),
          type: AddressDriverSplitReceiverType.ProjectDependency,
          blockTimestamp,
        },
        { transaction },
      );
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
      `Dependency with account ID ${dependency.accountId} is not an Address nor a Git Project.`,
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

async function clearCurrentProjectSplits(
  funderProjectId: string,
  transaction: Transaction,
) {
  await AddressDriverSplitReceiverModel.destroy({
    where: {
      funderProjectId,
    },
    transaction,
  });
  await RepoDriverSplitReceiverModel.destroy({
    where: {
      funderProjectId,
    },
    transaction,
  });
  await DripListSplitReceiverModel.destroy({
    where: {
      funderProjectId,
    },
    transaction,
  });
}
