/* eslint-disable no-param-reassign */ // Mutating Sequelize model instance is intentional and safe here.
import { type Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { z } from 'zod';
import { ProjectModel } from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import type ScopedLogger from '../../../core/ScopedLogger';
import {
  calculateProjectStatus,
  verifyProjectSources,
} from '../../../utils/projectUtils';
import type { IpfsHash, RepoDriverId } from '../../../core/types';
import {
  assertIsAddressDiverId,
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../../utils/accountIdUtils';
import unreachableError from '../../../utils/unreachableError';
import { getProjectMetadata } from '../../../utils/metadataUtils';
import verifySplitsReceivers from '../verifySplitsReceivers';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from '../receiversRepository';
import { makeVersion } from '../../../utils/lastProcessedVersion';
import RecoverableError from '../../../utils/recoverableError';
import type { gitHubSourceSchema } from '../../../metadata/schemas/common/sources';
import { ensureLinkedIdentityExists } from '../../../utils/linkedIdentityUtils';

type Params = {
  logIndex: number;
  ipfsHash: IpfsHash;
  blockNumber: number;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: RepoDriverId;
};

export default async function handleProjectMetadata({
  ipfsHash,
  logIndex,
  blockNumber,
  scopedLogger,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: Params) {
  const metadata = await getProjectMetadata(ipfsHash);

  assertIsGitHubProject(metadata);

  if (metadata.describes.accountId !== emitterAccountId) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: metadata describes account ID '${metadata.describes.accountId}' but metadata emitted by '${emitterAccountId}'.`,
    );

    return;
  }

  const { isMatch, actualHash, onChainHash } = await verifySplitsReceivers(
    emitterAccountId,
    [...metadata.splits.dependencies, ...metadata.splits.maintainers],
  );

  if (!isMatch) {
    scopedLogger.bufferMessage(
      `🚨 Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: on-chain splits hash '${onChainHash}' does not match '${actualHash}' calculated from metadata.`,
    );

    return;
  }

  const project = await ProjectModel.findByPk(emitterAccountId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!project) {
    scopedLogger.bufferMessage(
      `Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: project not found. Likely waiting on 'OwnerUpdated' event to be processed. Retrying, but if this persists, it is a real error.`,
    );

    scopedLogger.flush();

    throw new RecoverableError(
      `Cannot process metadata for Project ${emitterAccountId}: entity not found. Likely waiting on 'OwnerUpdated' event to be processed. Retrying, but if this persists, it is a real error.`,
    );
  }

  const projectReceivers = metadata.splits.dependencies.filter(
    (dep) => 'source' in dep && dep.source.forge === 'github',
  ) as { accountId: string; source: z.infer<typeof gitHubSourceSchema> }[];

  const { areProjectsValid, message } = await verifyProjectSources([
    ...projectReceivers,
    {
      accountId: emitterAccountId,
      source: metadata.source,
    },
  ]);

  if (!areProjectsValid) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: ${message}`,
    );

    return;
  }

  // We'll store `source` information the metadata, not from the 'OwnerUpdatedRequested' event.
  // Therefore, it's necessary to also verify the project's source directly.
  const { areProjectsValid: isProjectSourceValid } = await verifyProjectSources(
    [
      {
        accountId: emitterAccountId,
        source: metadata.source,
      },
    ],
  );

  if (!isProjectSourceValid) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: ${message}`,
    );
    return;
  }

  // ✅ All checks passed, we can proceed with the processing.

  await updateProject({
    project,
    ipfsHash,
    metadata,
    logIndex,
    blockNumber,
    transaction,
    scopedLogger,
  });

  deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    logIndex,
    blockNumber,
    scopedLogger,
    transaction,
    blockTimestamp,
    emitterAccountId,
    splitReceivers: metadata.splits,
  });
}

async function updateProject({
  project,
  logIndex,
  metadata,
  ipfsHash,
  transaction,
  blockNumber,
  scopedLogger,
}: {
  logIndex: number;
  blockNumber: number;
  project: ProjectModel;
  ipfsHash: IpfsHash;
  transaction: Transaction;
  scopedLogger: ScopedLogger;
  metadata: GitHubProjectMetadata;
}): Promise<void> {
  const { color, source } = metadata;

  project.url = source.url;
  project.forge = source.forge;
  project.name = `${source.ownerName}/${source.repoName}`;
  project.color = color;

  project.lastProcessedIpfsHash = ipfsHash;
  project.lastProcessedVersion = makeVersion(blockNumber, logIndex).toString();
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

  scopedLogger.bufferUpdate({
    type: ProjectModel,
    input: project,
    id: project.accountId,
  });

  await project.save({ transaction });
}

async function createNewSplitReceivers({
  logIndex,
  blockNumber,
  transaction,
  scopedLogger,
  blockTimestamp,
  splitReceivers,
  emitterAccountId,
}: {
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: RepoDriverId;
  splitReceivers: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'];
}) {
  const { dependencies, maintainers } = splitReceivers;

  const maintainerPromises = maintainers.map(async (maintainer) => {
    assertIsAddressDiverId(maintainer.accountId);

    return createSplitReceiver({
      scopedLogger,
      transaction,
      splitReceiverShape: {
        senderAccountId: emitterAccountId,
        senderAccountType: 'project',
        receiverAccountId: maintainer.accountId,
        receiverAccountType: 'address',
        relationshipType: 'project_maintainer',
        weight: maintainer.weight,
        blockTimestamp,
      },
    });
  });

  const dependencyPromises = dependencies.map(async (dependency) => {
    if (isRepoDriverId(dependency.accountId)) {
      if (!('source' in dependency)) {
        throw new Error(
          `Project dependency ${dependency.accountId} is missing source information.`,
        );
      }

      if (dependency.source.forge === 'orcid') {
        await ensureLinkedIdentityExists(
          dependency.accountId,
          { blockNumber, logIndex },
          transaction,
          scopedLogger,
        );

        return createSplitReceiver({
          scopedLogger,
          transaction,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'project',
            receiverAccountId: dependency.accountId,
            receiverAccountType: 'linked_identity',
            relationshipType: 'project_dependency',
            weight: dependency.weight,
            blockTimestamp,
          },
        });
      }

      await ProjectModel.findOrCreate({
        transaction,
        lock: transaction.LOCK.UPDATE,
        where: {
          accountId: dependency.accountId,
        },
        defaults: {
          accountId: dependency.accountId,
          verificationStatus: 'unclaimed',
          isVisible: true, // Visible by default. Account metadata will set the final visibility.
          isValid: true, // There are no receivers yet. Consider the project valid.
          url: dependency.source.url,
          forge: dependency.source.forge,
          name: `${dependency.source.ownerName}/${dependency.source.repoName}`,
          lastProcessedVersion: makeVersion(blockNumber, logIndex).toString(),
        },
      });

      return createSplitReceiver({
        scopedLogger,
        transaction,
        splitReceiverShape: {
          senderAccountId: emitterAccountId,
          senderAccountType: 'project',
          receiverAccountId: dependency.accountId,
          receiverAccountType: 'project',
          relationshipType: 'project_dependency',
          weight: dependency.weight,
          blockTimestamp,
        },
      });
    }

    if (isAddressDriverId(dependency.accountId)) {
      return createSplitReceiver({
        scopedLogger,
        transaction,
        splitReceiverShape: {
          senderAccountId: emitterAccountId,
          senderAccountType: 'project',
          receiverAccountId: dependency.accountId,
          receiverAccountType: 'address',
          relationshipType: 'project_dependency',
          weight: dependency.weight,
          blockTimestamp,
        },
      });
    }

    if (isNftDriverId(dependency.accountId)) {
      return createSplitReceiver({
        scopedLogger,
        transaction,
        splitReceiverShape: {
          senderAccountId: emitterAccountId,
          senderAccountType: 'project',
          receiverAccountId: dependency.accountId,
          receiverAccountType: 'drip_list',
          relationshipType: 'project_dependency',
          weight: dependency.weight,
          blockTimestamp,
        },
      });
    }

    return unreachableError(
      `Unhandled Project Split Receiver type: ${(dependency as any).type}`,
    );
  });

  await Promise.all([...maintainerPromises, ...dependencyPromises]);
}

type GitHubProjectMetadata = AnyVersion<
  typeof repoDriverAccountMetadataParser
> & {
  source: z.infer<typeof gitHubSourceSchema>;
};

function assertIsGitHubProject(
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): asserts metadata is GitHubProjectMetadata {
  if (metadata.source.forge !== 'github') {
    throw new Error(
      `Expected GitHub project metadata but got forge: ${metadata.source.forge}`,
    );
  }
}
