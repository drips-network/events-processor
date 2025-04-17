/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { z } from 'zod';
import type { IpfsHash, NftDriverId } from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import type LogManager from '../../../core/LogManager';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import appSettings from '../../../config/appSettings';
import type { dripListSplitReceiverSchema } from '../../../metadata/schemas/nft-driver/v2';
import type {
  repoDriverSplitReceiverSchema,
  addressDriverSplitReceiverSchema,
} from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/immutable-splits-driver/v1';
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
  validateMetadata(metadata);

  if (metadata.describes.accountId !== emitterAccountId) {
    logManager.appendLog(
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
    logManager.appendLog(
      `Skipped Drip List ${emitterAccountId} metadata processing: on-chain splits hash '${onChainHash}' does not match hash '${actualHash}' calculated from metadata.`,
    );

    return;
  }

  const { areProjectsValid, message } = await verifyProjectSources(
    splitReceivers.filter((r) => r.type === 'repoDriver'),
  );

  if (!areProjectsValid) {
    logManager.appendLog(
      `🚨🕵️‍♂️ Skipped Drip List ${emitterAccountId} metadata processing: ${message}`,
    );

    return;
  }

  // ✅ All checks passed, we can proceed with the processing.

  await upsertDripList({
    ipfsHash,
    metadata,
    logManager,
    blockNumber,
    transaction,
  });

  deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    logManager,
    transaction,
    blockTimestamp,
    emitterAccountId,
    splitReceivers,
  });
}

async function upsertDripList({
  ipfsHash,
  metadata,
  logManager,
  blockNumber,
  transaction,
}: {
  ipfsHash: IpfsHash;
  blockNumber: number;
  logManager: LogManager;
  transaction: Transaction;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
}) {
  const [dripList, isCreated] = await DripListModel.upsert(
    {
      accountId: convertToNftDriverId(metadata.describes.accountId),
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
      isValid: false, // Until the `Transfer` event is processed.
    },
    {
      transaction,
    },
  );

  logManager.appendUpsertLog(
    dripList,
    DripListModel,
    dripList.accountId,
    Boolean(isCreated),
  );
}

async function createNewSplitReceivers({
  splitReceivers,
  logManager,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  splitReceivers: (
    | z.infer<typeof repoDriverSplitReceiverSchema>
    | z.infer<typeof subListSplitReceiverSchema>
    | z.infer<typeof addressDriverSplitReceiverSchema>
    | z.infer<typeof dripListSplitReceiverSchema>
  )[];
}) {
  const receiverPromises = splitReceivers.map(async (receiver) => {
    switch (receiver.type) {
      case 'repoDriver':
        assertIsRepoDriverId(receiver.accountId);
        return createSplitReceiver({
          logManager,
          transaction,
          blockTimestamp,
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
          logManager,
          transaction,
          blockTimestamp,
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
          logManager,
          transaction,
          blockTimestamp,
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
  const isCurrent = 'recipients' in metadata && metadata.type === 'dripList';
  const isLegacy = 'projects' in metadata;

  if (!isCurrent && !isLegacy) {
    throw new Error('Invalid Drip List metadata schema.');
  }
}
