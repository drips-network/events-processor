/* eslint-disable no-param-reassign */ // Mutating Sequelize model instance is intentional and safe here.
import { type Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import { ProjectModel } from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import type ScopedLogger from '../../../core/ScopedLogger';
import {
  calculateProjectStatus,
  verifyProjectSources,
} from '../../../utils/projectUtils';
import type {
  Address,
  AddressDriverId,
  IpfsHash,
  RepoDriverId,
} from '../../../core/types';
import {
  assertIsAddressDiverId,
  convertToAddressDriverId,
  convertToRepoDriverId,
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../../utils/accountIdUtils';
import unreachableError from '../../../utils/unreachableError';
import { getProjectMetadata } from '../../../utils/metadataUtils';
import verifySplitsReceivers from '../verifySplitsReceivers';
import {
  addressDriverContract,
  repoDriverContract,
} from '../../../core/contractClients';
import type { ProjectName } from '../../../models/ProjectModel';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from '../receiversRepository';
import {
  decodeVersion,
  makeVersion,
} from '../../../utils/lastProcessedVersion';

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

  const projectReceivers = metadata.splits.dependencies.flatMap((s) =>
    'source' in s ? [s] : [],
  );
  const { areProjectsValid, message } =
    await verifyProjectSources(projectReceivers);

  if (!areProjectsValid) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: ${message}`,
    );

    return;
  }

  // ✅ All checks passed, we can proceed with the processing.

  await upsertProject({
    logIndex,
    metadata,
    ipfsHash,
    blockNumber,
    scopedLogger,
    transaction,
    blockTimestamp,
  });

  deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    scopedLogger,
    transaction,
    blockTimestamp,
    emitterAccountId,
    splitReceivers: metadata.splits,
  });
}

async function upsertProject({
  ipfsHash,
  logIndex,
  metadata,
  blockNumber,
  scopedLogger,
  transaction,
  blockTimestamp,
}: {
  logIndex: number;
  ipfsHash: IpfsHash;
  blockNumber: number;
  blockTimestamp: Date;
  transaction: Transaction;
  scopedLogger: ScopedLogger;
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>;
}): Promise<void> {
  const {
    color,
    source: { forge, ownerName, repoName, url },
    describes,
  } = metadata;

  function getEmoji(): string | null {
    if ('avatar' in metadata) {
      return metadata.avatar.type === 'emoji' ? metadata.avatar.emoji : null;
    }

    return metadata.emoji ?? null;
  }

  function getAvatarCid(): string | null {
    if ('avatar' in metadata && metadata.avatar.type === 'image') {
      return metadata.avatar.cid;
    }

    return null;
  }

  const accountId = convertToRepoDriverId(describes.accountId);
  const onChainOwner = (await repoDriverContract.ownerOf(accountId)) as Address;

  const values = {
    accountId,
    url,
    forge,
    emoji: getEmoji(),
    color,
    name: `${ownerName}/${repoName}` as ProjectName,
    avatarCid: getAvatarCid(),
    verificationStatus: calculateProjectStatus(onChainOwner),
    isVisible: 'isVisible' in metadata ? metadata.isVisible : true, // Projects without `isVisible` field (V4 and below) are considered visible by default.
    lastProcessedIpfsHash: ipfsHash,
    ownerAddress: onChainOwner,
    ownerAccountId: convertToAddressDriverId(
      (await addressDriverContract.calcAccountId(onChainOwner)).toString(),
    ) as AddressDriverId,
    claimedAt: blockTimestamp,
    lastProcessedVersion: makeVersion(blockNumber, logIndex).toString(),
  };

  const [project, isCreation] = await ProjectModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: { accountId },
    defaults: {
      ...values,
      isValid: false, // Until the `SplitsSet` event is processed.
    },
  });

  if (!isCreation) {
    const newVersion = makeVersion(blockNumber, logIndex);
    const storedVersion = BigInt(project.lastProcessedVersion);
    const { blockNumber: sb, logIndex: sl } = decodeVersion(storedVersion);

    if (newVersion <= storedVersion) {
      scopedLogger.log(
        `Skipped Project ${accountId} stale 'AccountMetadata' event (${blockNumber}:${logIndex} ≤ lastProcessed ${sb}:${sl}).`,
      );

      return;
    }

    scopedLogger.bufferUpdate({
      type: ProjectModel,
      input: project,
      id: project.accountId,
    });

    await project.update(values, { transaction });
  } else {
    scopedLogger.bufferCreation({
      type: ProjectModel,
      input: project,
      id: project.accountId,
    });
  }
}

async function createNewSplitReceivers({
  scopedLogger,
  transaction,
  splitReceivers,
  blockTimestamp,
  emitterAccountId,
}: {
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
      blockTimestamp,
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
      return createSplitReceiver({
        scopedLogger,
        transaction,
        blockTimestamp,
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
        blockTimestamp,
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
        blockTimestamp,
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
