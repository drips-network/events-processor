/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type {
  Address,
  AddressDriverId,
  IpfsHash,
  NftDriverId,
} from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import type ScopedLogger from '../../../core/ScopedLogger';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import appSettings from '../../../config/appSettings';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from '../receiversRepository';
import { verifyProjectSources } from '../../../utils/projectUtils';
import DripListModel from '../../../models/DripListModel';
import {
  assertIsAddressDiverId,
  assertIsNftDriverId,
  assertIsRepoDriverId,
  convertToNftDriverId,
} from '../../../utils/accountIdUtils';
import { makeVersion } from '../../../utils/lastProcessedVersion';
import {
  addressDriverContract,
  nftDriverContract,
} from '../../../core/contractClients';
import { ProjectModel } from '../../../models';

type Params = {
  ipfsHash: IpfsHash;
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
};

export default async function handleDripListMetadata({
  ipfsHash,
  logIndex,
  metadata,
  scopedLogger,
  blockNumber,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: Params) {
  validateMetadata(metadata);

  if (metadata.describes.accountId !== emitterAccountId) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped Drip List ${emitterAccountId} metadata processing: metadata describes account ID '${metadata.describes.accountId}' but metadata emitted by '${emitterAccountId}'.`,
    );

    return;
  }

  const splitReceivers = metadata.projects ?? metadata.recipients;

  const { isMatch, actualHash, onChainHash } = await verifySplitsReceivers(
    emitterAccountId,
    splitReceivers.map(({ weight, accountId }) => ({
      weight,
      accountId,
    })),
  );

  if (!isMatch) {
    scopedLogger.bufferMessage(
      `Skipped Drip List ${emitterAccountId} metadata processing: on-chain splits hash '${onChainHash}' does not match hash '${actualHash}' calculated from metadata.`,
    );

    return;
  }

  const { areProjectsValid, message } = await verifyProjectSources(
    splitReceivers.filter(
      (
        splitReceiver,
      ): splitReceiver is typeof splitReceiver & { source: any } =>
        'source' in splitReceiver && splitReceiver.source.forge !== 'orcid',
    ),
  );

  if (!areProjectsValid) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped Drip List ${emitterAccountId} metadata processing: ${message}`,
    );

    return;
  }

  // ✅ All checks passed, we can proceed with the processing.

  await upsertDripList({
    ipfsHash,
    logIndex,
    metadata,
    scopedLogger,
    blockNumber,
    transaction,
  });

  deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    metadata,
    logIndex,
    blockNumber,
    transaction,
    scopedLogger,
    blockTimestamp,
    emitterAccountId,
  });
}

async function upsertDripList({
  ipfsHash,
  logIndex,
  metadata,
  scopedLogger,
  blockNumber,
  transaction,
}: {
  logIndex: number;
  ipfsHash: IpfsHash;
  blockNumber: number;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
}) {
  const accountId = convertToNftDriverId(metadata.describes.accountId);

  const onChainOwner = (await nftDriverContract.ownerOf(accountId)) as Address;

  const values = {
    accountId,
    name: metadata.name ?? null,
    description:
      'description' in metadata ? metadata.description || null : null,
    ownerAddress: onChainOwner,
    ownerAccountId: (
      await addressDriverContract.calcAccountId(onChainOwner)
    ).toString() as AddressDriverId,
    latestVotingRoundId:
      'latestVotingRoundId' in metadata
        ? (metadata.latestVotingRoundId as UUID) || null
        : null,
    lastProcessedIpfsHash: ipfsHash,
    lastProcessedVersion: makeVersion(blockNumber, logIndex).toString(),
  };

  const [dripList, isCreation] = await DripListModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: { accountId },
    defaults: {
      ...values,
      isValid: false, // Until the `SplitsSet` event is processed.
      isVisible:
        blockNumber > appSettings.visibilityThresholdBlockNumber &&
        'isVisible' in metadata
          ? metadata.isVisible
          : true,
    },
  });

  if (isCreation) {
    scopedLogger.bufferCreation({
      id: accountId,
      type: DripListModel,
      input: dripList,
    });
  } else {
    const newVersion = makeVersion(blockNumber, logIndex);
    const storedVersion = BigInt(dripList.lastProcessedVersion);

    // Safely update fields that another event handler could also modify.
    if (newVersion > storedVersion) {
      dripList.isVisible =
        blockNumber > appSettings.visibilityThresholdBlockNumber &&
        'isVisible' in metadata
          ? metadata.isVisible
          : true;
    }

    scopedLogger.bufferUpdate({
      id: accountId,
      type: DripListModel,
      input: dripList,
    });

    await dripList.update(
      { ...values, isVisible: dripList.isVisible },
      { transaction },
    );
  }
}

async function createNewSplitReceivers({
  metadata,
  logIndex,
  blockNumber,
  scopedLogger,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: {
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
}) {
  const rawReceivers =
    // eslint-disable-next-line no-nested-ternary
    'recipients' in metadata
      ? (metadata.recipients ?? [])
      : 'projects' in metadata
        ? (metadata.projects ?? [])
        : [];

  // 2. Upgrade legacy payloads so that *every* receiver object has a `type`.
  //    – v2+ entries already expose `type`.
  //    – v1 repo receivers carry a `source` property.
  const splitReceivers = rawReceivers.map((receiver: any) => {
    if ('type' in receiver) {
      return receiver; // v6 or v2–v5.
    }

    // v1 without `type`.
    if ('source' in receiver) {
      // Legacy repo driver receiver.
      return { ...receiver, type: 'repoDriver' } as const;
    }

    // Legacy address receiver.
    return { ...receiver, type: 'address' } as const;
  });

  // Nothing to persist.
  if (splitReceivers.length === 0) {
    return;
  }

  // 3. Persist receivers.
  const receiverPromises = splitReceivers.map(async (receiver) => {
    switch (receiver.type) {
      case 'orcid':
        assertIsRepoDriverId(receiver.accountId);
        return createSplitReceiver({
          scopedLogger,
          transaction,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'drip_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'linked_identity',
            relationshipType: 'drip_list_receiver',
            weight: receiver.weight,
            blockTimestamp,
          },
        });

      case 'repoDriver':
        assertIsRepoDriverId(receiver.accountId);

        await ProjectModel.findOrCreate({
          transaction,
          lock: transaction.LOCK.UPDATE,
          where: {
            accountId: receiver.accountId,
          },
          defaults: {
            accountId: receiver.accountId,
            verificationStatus: 'unclaimed',
            isVisible: true, // Visible by default. Account metadata will set the final visibility.
            isValid: true, // There are no receivers yet. Consider the project valid.
            url: receiver.source.url,
            forge: receiver.source.forge,
            name: `${receiver.source.ownerName}/${receiver.source.repoName}`,
            lastProcessedVersion: makeVersion(blockNumber, logIndex).toString(),
          },
        });

        return createSplitReceiver({
          scopedLogger,
          transaction,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'drip_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'project',
            relationshipType: 'drip_list_receiver',
            weight: receiver.weight,
            blockTimestamp,
          },
        });

      case 'dripList':
        assertIsNftDriverId(receiver.accountId);
        return createSplitReceiver({
          scopedLogger,
          transaction,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'drip_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'drip_list',
            relationshipType: 'drip_list_receiver',
            weight: receiver.weight,
            blockTimestamp,
          },
        });

      case 'address':
        assertIsAddressDiverId(receiver.accountId);
        return createSplitReceiver({
          scopedLogger,
          transaction,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'drip_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'address',
            relationshipType: 'drip_list_receiver',
            weight: receiver.weight,
            blockTimestamp,
          },
        });

      default:
        return unreachableError(
          `Unhandled Drip List Split Receiver type: ${(receiver as any).type}`,
        );
    }
  });

  await Promise.all(receiverPromises);
}

function validateMetadata(
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
) {
  const isV6 = 'recipients' in metadata && metadata.type === 'dripList';
  const isV5AndBelow = 'projects' in metadata;

  if (!isV6 && !isV5AndBelow) {
    throw new Error('Invalid Drip List metadata schema.');
  }
}
