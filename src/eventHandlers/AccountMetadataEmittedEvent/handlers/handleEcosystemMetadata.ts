import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import appSettings from '../../../config/appSettings';
import LogManager from '../../../core/LogManager';
import type { IpfsHash, NftDriverId } from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import {
  EcosystemModel,
  AccountMetadataEmittedEventModel,
} from '../../../models';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import { isLatestEvent } from '../../../utils/eventUtils';
import type { repoDriverSplitReceiverSchema } from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/sub-list/v1';
import verifyProjectSources from '../projectVerification';
import {
  createProjectAndProjectReceiver,
  createSubListReceiver,
  deleteExistingReceivers,
} from '../receiversRepository';

type Params = {
  ipfsHash: IpfsHash;
  blockNumber: number;
  blockTimestamp: Date;
  logManager: LogManager;
  ecosystemId: NftDriverId;
  transaction: Transaction;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
  originEventDetails: {
    entity: AccountMetadataEmittedEventModel;
    logIndex: number;
    transactionHash: string;
  };
};

export default async function handleEcosystemMetadata({
  ipfsHash,
  metadata,
  logManager,
  ecosystemId,
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
        accountId: ecosystemId,
      },
      transaction,
    ))
  ) {
    logManager.logAllInfo();

    return;
  }
  logManager.appendIsLatestEventLog();

  assertMetadataIsValid(ecosystemId, metadata);

  // Here, is the only place an Ecosystem is created.
  const ecosystem = await EcosystemModel.create(
    {
      id: ecosystemId,
      isValid: false, // Until the related `TransferEvent` is processed.
      name: metadata.name ?? null,
      description:
        'description' in metadata ? metadata.description || null : null,
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
    .appendFindOrCreateLog(EcosystemModel, true, ecosystem.id)
    .logAllInfo();

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await verifySplitsReceivers(
      ecosystem.id,
      metadata.recipients.map(({ weight, accountId }) => ({
        weight,
        accountId,
      })),
    );

  if (!areSplitsValid) {
    logManager.appendLog(
      [
        `Skipping metadata update for Ecosystem ${ecosystemId} due to mismatch in splits hash.`,
        `  On-chain hash: ${onChainSplitsHash}`,
        `  Metadata hash: ${calculatedSplitsHash}`,
        `  Possible causes:`,
        `    - The metadata event is the latest in the DB, but not on-chain.`,
        `    - The metadata was manually emitted with outdated or mismatched splits.`,
      ].join('\n'),
    );

    return;
  }

  await verifyProjectSources(metadata.recipients);

  await deleteExistingReceivers({
    for: {
      accountId: ecosystemId,
      column: 'funderEcosystemId',
    },
    transaction,
  });

  await setNewReceivers({
    logManager,
    transaction,
    blockTimestamp,
    receivers: metadata.recipients,
    funderEcosystemId: ecosystemId,
  });
}

async function setNewReceivers({
  receivers,
  logManager,
  transaction,
  blockTimestamp,
  funderEcosystemId,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  funderEcosystemId: NftDriverId;
  receivers: (
    | z.infer<typeof repoDriverSplitReceiverSchema>
    | z.infer<typeof subListSplitReceiverSchema>
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
            type: 'ecosystem',
            accountId: funderEcosystemId,
          },
        });

      case 'subList':
        return createSubListReceiver({
          logManager,
          transaction,
          blockTimestamp,
          metadataReceiver: receiver,
          funder: {
            type: 'ecosystem',
            accountId: funderEcosystemId,
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
      EcosystemModel,
    )} with ID ${funderEcosystemId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
  );
}

function assertMetadataIsValid(
  ecosystemId: NftDriverId,
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): asserts metadata is Extract<
  typeof metadata,
  {
    type: 'ecosystem';
    recipients: (
      | z.infer<typeof repoDriverSplitReceiverSchema>
      | z.infer<typeof subListSplitReceiverSchema>
    )[];
  }
> {
  if (ecosystemId !== metadata.describes.accountId) {
    unreachableError(
      `Ecosystem metadata describes account ID ${metadata.describes.accountId} but it was emitted by ${ecosystemId}.`,
    );
  }

  if (
    !(
      'recipients' in metadata &&
      'type' in metadata &&
      metadata.type === 'ecosystem'
    )
  ) {
    throw new Error('Invalid Ecosystem metadata.');
  }
}
