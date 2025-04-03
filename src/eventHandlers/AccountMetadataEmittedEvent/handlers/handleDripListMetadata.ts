/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { z } from 'zod';
import type { IpfsHash, NftDriverId } from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../core/LogManager';
import {
  AccountMetadataEmittedEventModel,
  DripListModel,
} from '../../../models';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import appSettings from '../../../config/appSettings';
import { isLatestEvent } from '../../../utils/eventUtils';
import type { dripListSplitReceiverSchema } from '../../../metadata/schemas/nft-driver/v2';
import type {
  repoDriverSplitReceiverSchema,
  addressDriverSplitReceiverSchema,
} from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/sub-list/v1';
import verifyProjectSources from '../projectVerification';
import {
  deleteExistingReceivers,
  createProjectAndProjectReceiver,
  createSubListReceiver,
  createDripListReceiver,
  createAddressReceiver,
} from '../receiversRepository';

type Params = {
  ipfsHash: IpfsHash;
  blockNumber: number;
  blockTimestamp: Date;
  logManager: LogManager;
  dripListId: NftDriverId;
  transaction: Transaction;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
  originEventDetails: {
    entity: AccountMetadataEmittedEventModel;
    logIndex: number;
    transactionHash: string;
  };
};

export default async function handleDripListMetadata({
  ipfsHash,
  metadata,
  logManager,
  dripListId,
  blockNumber,
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
        accountId: dripListId,
      },
      transaction,
    ))
  ) {
    logManager.logAllInfo();

    return;
  }
  logManager.appendIsLatestEventLog();

  assertMetadataIsValid(dripListId, metadata);

  // Here, is the only place an Drip List is created.
  const dripList = await DripListModel.create(
    {
      id: dripListId,
      isValid: false, // Until the related `TransferEvent` is processed.
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
    },
    { transaction },
  );

  logManager
    .appendFindOrCreateLog(DripListModel, true, dripList.id)
    .logAllInfo();

  const receivers = metadata.projects ?? metadata.recipients;

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await verifySplitsReceivers(
      dripList.id,
      receivers.map(({ weight, accountId }) => ({
        weight,
        accountId,
      })),
    );

  if (!areSplitsValid) {
    logManager.appendLog(
      [
        `Skipping metadata update for Drip List ${dripListId} due to mismatch in splits hash.`,
        `  On-chain hash: ${onChainSplitsHash}`,
        `  Metadata hash: ${calculatedSplitsHash}`,
        `  Possible causes:`,
        `    - The metadata event is the latest in the DB, but not on-chain.`,
        `    - The metadata was manually emitted with outdated or mismatched splits.`,
      ].join('\n'),
    );

    return;
  }

  await verifyProjectSources(receivers);

  await deleteExistingReceivers({
    for: {
      accountId: dripListId,
      column: 'funderDripListId',
    },
    transaction,
  });

  await setNewReceivers({
    receivers,
    logManager,
    transaction,
    blockTimestamp,
    funderDripListId: dripListId,
  });
}

async function setNewReceivers({
  receivers,
  logManager,
  transaction,
  blockTimestamp,
  funderDripListId,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  funderDripListId: NftDriverId;
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
        return createProjectAndProjectReceiver({
          logManager,
          transaction,
          blockTimestamp,
          metadataReceiver: receiver,
          funder: {
            type: 'dripList',
            accountId: funderDripListId,
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
            accountId: funderDripListId,
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
            accountId: funderDripListId,
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
            accountId: funderDripListId,
          },
        });

      default:
        return unreachableError(
          `Unhandled receiver type: ${(receiver as any).type}`,
        );
    }
  });

  const result = await Promise.all(receiverPromises);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(
      DripListModel,
    )} with ID ${funderDripListId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
  );
}

function assertMetadataIsValid(
  dripListId: NftDriverId,
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
  if (dripListId !== metadata.describes.accountId) {
    unreachableError(
      `Drip List metadata describes account ID '${metadata.describes.accountId}' but it was emitted by ${dripListId}.`,
    );
  }

  const isCurrent = 'recipients' in metadata && metadata.type === 'dripList';
  const isLegacy = 'projects' in metadata;

  if (!isCurrent && !isLegacy) {
    throw new Error('Invalid Drip List metadata format.');
  }
}
