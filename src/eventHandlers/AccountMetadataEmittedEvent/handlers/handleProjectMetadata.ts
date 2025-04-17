/* eslint-disable no-param-reassign */ // Mutating Sequelize model instance is intentional and safe here.
import { type Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import { ZeroAddress } from 'ethers';
import { ProjectModel } from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import type LogManager from '../../../core/LogManager';
import {
  calculateProjectStatus,
  verifyProjectSources,
} from '../../../utils/projectUtils';
import type { Address, IpfsHash, RepoDriverId } from '../../../core/types';
import {
  assertIsAddressDiverId,
  convertToAddressDriverId,
  convertToRepoDriverId,
  getAddress,
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../../utils/accountIdUtils';
import unreachableError from '../../../utils/unreachableError';
import { getProjectMetadata } from '../../../utils/metadataUtils';
import verifySplitsReceivers from '../verifySplitsReceivers';
import { repoDriverContract } from '../../../core/contractClients';
import type { ProjectName } from '../../../models/ProjectModel';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from '../receiversRepository';

type Params = {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: RepoDriverId;
};

export default async function handleProjectMetadata({
  ipfsHash,
  logManager,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: Params) {
  const metadata = await getProjectMetadata(ipfsHash);

  if (metadata.describes.accountId !== emitterAccountId) {
    logManager.appendLog(
      `🚨🕵️‍♂️ Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: metadata describes account ID '${metadata.describes.accountId}' but metadata emitted by '${emitterAccountId}'.`,
    );

    return;
  }

  const { isMatch, actualHash, onChainHash } = await verifySplitsReceivers(
    emitterAccountId,
    [...metadata.splits.dependencies, ...metadata.splits.maintainers],
  );

  if (!isMatch) {
    logManager.appendLog(
      `🚨 Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: on-chain splits hash '${onChainHash}' does not match '${actualHash}' calculated from metadata.`,
    );

    return;
  }

  const projectReceivers = metadata.splits.dependencies
    .flatMap((s) => ('type' in s && s.type === 'repoDriver' ? [s] : []))
    .filter((dep) => dep.type === 'repoDriver');
  const { areProjectsValid, message } =
    await verifyProjectSources(projectReceivers);

  if (!areProjectsValid) {
    logManager.appendLog(
      `🚨🕵️‍♂️ Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: ${message}`,
    );

    return;
  }

  const onChainOwner = await repoDriverContract.ownerOf(emitterAccountId);
  if (!onChainOwner || onChainOwner === ZeroAddress) {
    logManager.appendLog(
      `🚨🕵️‍♂️ Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: on-chain owner is not set.`,
    );
  }

  // ✅ All checks passed, we can proceed with the processing.

  await upsertProject({
    metadata,
    ipfsHash,
    logManager,
    transaction,
    blockTimestamp,
    onChainOwner: onChainOwner as Address,
  });

  deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    logManager,
    transaction,
    blockTimestamp,
    emitterAccountId,
    splitReceivers: metadata.splits,
  });
}

async function upsertProject({
  ipfsHash,
  metadata,
  logManager,
  transaction,
  onChainOwner,
  blockTimestamp,
}: {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  onChainOwner: Address;
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>;
}): Promise<void> {
  const {
    color,
    source: { forge, ownerName, repoName, url },
    describes: { accountId },
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

  const [project, isCreated] = await ProjectModel.upsert(
    {
      accountId: convertToRepoDriverId(accountId),
      url,
      forge,
      emoji: getEmoji(),
      color,
      name: `${ownerName}/${repoName}` as ProjectName,
      avatarCid: getAvatarCid(),
      verificationStatus: calculateProjectStatus(onChainOwner),
      isVisible: 'isVisible' in metadata ? metadata.isVisible : true, // Projects without `isVisible` field (V4 and below) are considered visible by default.
      lastProcessedIpfsHash: ipfsHash,
      ownerAddress: getAddress(onChainOwner),
      ownerAccountId: convertToAddressDriverId(onChainOwner),
      claimedAt: blockTimestamp,
    },
    {
      transaction,
    },
  );

  logManager.appendUpsertLog(
    project,
    ProjectModel,
    project.accountId,
    Boolean(isCreated),
  );
}

async function createNewSplitReceivers({
  logManager,
  transaction,
  splitReceivers,
  blockTimestamp,
  emitterAccountId,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: RepoDriverId;
  splitReceivers: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'];
}) {
  const { dependencies, maintainers } = splitReceivers;

  const maintainerPromises = maintainers.map(async (maintainer) => {
    assertIsAddressDiverId(maintainer.accountId);

    return createSplitReceiver({
      logManager,
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
        logManager,
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
        logManager,
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
        logManager,
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
