/* eslint-disable no-param-reassign */ // Mutating Sequelize model instance is intentional and safe here.
import { type Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import { ZeroAddress } from 'ethers';
import { ProjectModel } from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import type ScopedLogger from '../../../core/ScopedLogger';
import {
  calculateProjectStatus,
  verifyProjectSources,
} from '../../../utils/projectUtils';
import type { Address, IpfsHash, RepoDriverId } from '../../../core/types';
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

type Params = {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: RepoDriverId;
};

export default async function handleProjectMetadata({
  ipfsHash,
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

  const onChainOwner = await repoDriverContract.ownerOf(emitterAccountId);
  // If on-chain owner is still unset, it likely means the first `OwnerUpdateRequested` and `OwnerUpdated` events were not emitted (yet?). No need to process the metadata.
  if (!onChainOwner || onChainOwner === ZeroAddress) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: on-chain owner is not set.`,
    );

    return;
  }

  // ✅ All checks passed, we can proceed with the processing.

  await upsertProject({
    metadata,
    ipfsHash,
    scopedLogger,
    transaction,
    blockTimestamp,
    onChainOwner: onChainOwner as Address,
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
  metadata,
  scopedLogger,
  transaction,
  onChainOwner,
  blockTimestamp,
}: {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  onChainOwner: Address;
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
    ),
    claimedAt: blockTimestamp,
  };

  const [project, isCreation] = await ProjectModel.findOrCreate({
    where: { accountId },
    defaults: {
      ...values,
      isValid: false, // Until the `SplitsSet` event is processed.
    },
  });

  if (!isCreation) {
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
