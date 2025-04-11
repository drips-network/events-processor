import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import appSettings from '../../../config/appSettings';
import type LogManager from '../../../core/LogManager';
import type { IpfsHash, NftDriverId } from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import { EcosystemMainAccountModel } from '../../../models';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import type { repoDriverSplitReceiverSchema } from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/immutable-splits-driver/v1';
import verifyProjectSources from '../projectVerification';
import {
  createProjectReceiver,
  createSubListReceiver,
  deleteExistingReceivers,
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

export default async function handleEcosystemMainAccountMetadata({
  ipfsHash,
  metadata,
  logManager,
  blockNumber,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: Params) {
  validateMetadata(emitterAccountId, metadata);

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await verifySplitsReceivers(
      emitterAccountId,
      metadata.recipients.map(({ weight, accountId }) => ({
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
  await verifyProjectSources(metadata.recipients);

  const ecosystemMainAccountProps = {
    id: emitterAccountId,
    name: metadata.name ?? null,
    description:
      'description' in metadata ? metadata.description || null : null,
    lastProcessedIpfsHash: ipfsHash,
    isVisible:
      blockNumber > appSettings.visibilityThresholdBlockNumber &&
      'isVisible' in metadata
        ? metadata.isVisible
        : true,
  };

  const [ecosystemMainAccount, isCreated] =
    await EcosystemMainAccountModel.findOrCreate({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: { id: emitterAccountId },
      defaults: {
        ...ecosystemMainAccountProps,
        isValid: false, // Until the related `TransferEvent` is processed.
      },
    });

  if (isCreated) {
    logManager.appendFindOrCreateLog(
      EcosystemMainAccountModel,
      true,
      ecosystemMainAccount.id,
    );
  } else {
    ecosystemMainAccount.set(ecosystemMainAccountProps);

    logManager.appendUpdateLog(
      ecosystemMainAccount,
      EcosystemMainAccountModel,
      ecosystemMainAccount.id,
    );

    await ecosystemMainAccount.save({ transaction });
  }

  await deleteExistingReceivers({
    for: {
      accountId: emitterAccountId,
      column: 'funderEcosystemMainAccountId',
    },
    transaction,
  });

  await setNewReceivers({
    ipfsHash,
    logManager,
    transaction,
    blockTimestamp,
    emitterAccountId,
    receivers: metadata.recipients,
  });
}

async function setNewReceivers({
  receivers,
  logManager,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  receivers: (
    | z.infer<typeof repoDriverSplitReceiverSchema>
    | z.infer<typeof subListSplitReceiverSchema>
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
            type: 'ecosystem',
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
            type: 'ecosystem',
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
  {
    type: 'ecosystem';
    recipients: (
      | z.infer<typeof repoDriverSplitReceiverSchema>
      | z.infer<typeof subListSplitReceiverSchema>
    )[];
  }
> {
  if (emitterAccountId !== metadata.describes.accountId) {
    throw new Error(
      `Invalid Ecosystem Main Account metadata: emitter account ID is '${emitterAccountId}', but metadata describes '${metadata.describes.accountId}'.`,
    );
  }

  if (
    !(
      'recipients' in metadata &&
      'type' in metadata &&
      metadata.type === 'ecosystem'
    )
  ) {
    throw new Error('Invalid Ecosystem Main Account ID metadata schema.');
  }
}
