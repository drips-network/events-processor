/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { z } from 'zod';
import type { IpfsHash, NftDriverId } from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import type LogManager from '../../../core/LogManager';
import { DripListModel } from '../../../models';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import appSettings from '../../../config/appSettings';
import type { dripListSplitReceiverSchema } from '../../../metadata/schemas/nft-driver/v2';
import type {
  repoDriverSplitReceiverSchema,
  addressDriverSplitReceiverSchema,
} from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/immutable-splits-driver/v1';
import verifyProjectSources from '../projectVerification';
import {
  deleteExistingReceivers,
  createProjectReceiver,
  createSubListReceiver,
  createDripListReceiver,
  createAddressReceiver,
} from '../receiversRepository';

type Params = {
  ipfsHash: IpfsHash;
  blockNumber: number;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
};

export default async function handleDripListMetadata({
  ipfsHash,
  metadata,
  logManager,
  blockNumber,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: Params) {
  validateMetadata(emitterAccountId, metadata);

  const receivers = metadata.projects ?? metadata.recipients;

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await verifySplitsReceivers(
      emitterAccountId,
      receivers.map(({ weight, accountId }) => ({
        weight,
        accountId,
      })),
    );

  if (!areSplitsValid) {
    logManager.appendLog(
      `Skipped Drip List ${emitterAccountId} metadata processing: on-chain splits hash '${onChainSplitsHash}' does not match hash '${calculatedSplitsHash}' calculated from metadata.`,
    );

    return;
  }

  await verifyProjectSources(receivers);

  const dripListProps = {
    id: emitterAccountId,
    name: metadata.name ?? null,
    description:
      'description' in metadata ? metadata.description || null : null,
    latestVotingRoundId:
      'latestVotingRoundId' in metadata
        ? (metadata.latestVotingRoundId as UUID) || null
        : null,
    lastProcessedIpfsHash: ipfsHash,
    isVisible:
      blockNumber > appSettings.visibilityThresholdBlockNumber &&
      'isVisible' in metadata
        ? metadata.isVisible
        : true,
  };

  const [dripList, isCreated] = await DripListModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: {
      id: emitterAccountId,
    },
    defaults: {
      ...dripListProps,
      isValid: false, // Until the related `TransferEvent` is processed.
    },
  });

  if (isCreated) {
    logManager.appendFindOrCreateLog(DripListModel, true, dripList.id);
  } else {
    dripList.set(dripListProps);

    logManager.appendUpdateLog(dripList, DripListModel, dripList.id);

    await dripList.save({ transaction });
  }

  await deleteExistingReceivers({
    for: {
      accountId: emitterAccountId,
      column: 'funderDripListId',
    },
    transaction,
  });

  await setNewReceivers({
    receivers,
    logManager,
    transaction,
    blockTimestamp,
    emitterAccountId,
  });
}

async function setNewReceivers({
  receivers,
  logManager,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  receivers: (
    | z.infer<typeof repoDriverSplitReceiverSchema>
    | z.infer<typeof subListSplitReceiverSchema>
    | z.infer<typeof addressDriverSplitReceiverSchema>
    | z.infer<typeof dripListSplitReceiverSchema>
  )[];
}) {
  const receiverPromises = receivers.map(async (receiver) => {
    switch (receiver.type) {
      case 'repoDriver':
        return createProjectReceiver({
          logManager,
          transaction,
          blockTimestamp,
          metadataReceiver: receiver,
          funder: {
            type: 'dripList',
            accountId: emitterAccountId,
          },
        });

      case 'subList':
        return createSubListReceiver({
          logManager,
          transaction,
          blockTimestamp,
          metadataReceiver: receiver,
          funder: {
            type: 'dripList',
            accountId: emitterAccountId,
          },
        });

      case 'dripList':
        return createDripListReceiver({
          logManager,
          transaction,
          blockTimestamp,
          metadataReceiver: receiver,
          funder: {
            type: 'dripList',
            accountId: emitterAccountId,
          },
        });

      case 'address':
        return createAddressReceiver({
          logManager,
          transaction,
          blockTimestamp,
          metadataReceiver: receiver,
          funder: {
            type: 'dripList',
            accountId: emitterAccountId,
          },
        });

      default:
        return unreachableError(
          `Unhandled receiver type: ${(receiver as any).type}`,
        );
    }
  });

  await Promise.all(receiverPromises);
}

function validateMetadata(
  emitterAccountId: NftDriverId,
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): asserts metadata is Extract<
  typeof metadata,
  | {
      type: 'dripList';
      recipients: (
        | z.infer<typeof repoDriverSplitReceiverSchema>
        | z.infer<typeof subListSplitReceiverSchema>
        | z.infer<typeof addressDriverSplitReceiverSchema>
        | z.infer<typeof dripListSplitReceiverSchema>
      )[];
    }
  | {
      projects: (
        | z.infer<typeof repoDriverSplitReceiverSchema>
        | z.infer<typeof addressDriverSplitReceiverSchema>
        | z.infer<typeof dripListSplitReceiverSchema>
      )[];
    }
> {
  if (emitterAccountId !== metadata.describes.accountId) {
    throw new Error(
      `Invalid Drip List metadata: emitter account ID is '${emitterAccountId}', but metadata describes '${metadata.describes.accountId}'.`,
    );
  }

  const isCurrent = 'recipients' in metadata && metadata.type === 'dripList';
  const isLegacy = 'projects' in metadata;

  if (!isCurrent && !isLegacy) {
    throw new Error('Invalid Drip List metadata schema.');
  }
}
