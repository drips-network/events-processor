import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import type ScopedLogger from '../../../core/ScopedLogger';
import type { IpfsHash, NftDriverId } from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import verifySplitsReceivers from '../verifySplitsReceivers';
import type { repoDriverSplitReceiverSchema } from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/immutable-splits-driver/v1';
import { verifyProjectSources } from '../../../utils/projectUtils';
import {
  assertIsImmutableSplitsDriverId,
  assertIsRepoDriverId,
  convertToNftDriverId,
} from '../../../utils/accountIdUtils';
import { EcosystemMainAccountModel } from '../../../models';
import appSettings from '../../../config/appSettings';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from '../receiversRepository';
import unreachableError from '../../../utils/unreachableError';

type Params = {
  ipfsHash: IpfsHash;
  blockNumber: number;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
};

export default async function handleEcosystemMainAccountMetadata({
  ipfsHash,
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
      `🚨🕵️‍♂️ Skipped Ecosystem Main Account ${emitterAccountId} metadata processing: metadata describes account ID '${metadata.describes.accountId}' but metadata emitted by '${emitterAccountId}'.`,
    );

    return;
  }

  const { isMatch, actualHash, onChainHash } = await verifySplitsReceivers(
    emitterAccountId,
    metadata.recipients,
  );

  if (!isMatch) {
    scopedLogger.bufferMessage(
      `Skipped Ecosystem Main Account ${emitterAccountId} metadata processing: on-chain splits hash '${onChainHash}' does not match hash '${actualHash}' calculated from metadata.`,
    );

    return;
  }

  const { areProjectsValid, message } = await verifyProjectSources(
    metadata.recipients.filter((r) => r.type === 'repoDriver'),
  );

  if (!areProjectsValid) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped Ecosystem Main Account ${emitterAccountId} metadata processing: ${message}`,
    );
  }

  // ✅ All checks passed, we can proceed with the processing.

  await upsertEcosystemMainAccount({
    ipfsHash,
    metadata,
    scopedLogger,
    blockNumber,
    transaction,
  });

  deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    scopedLogger,
    transaction,
    blockTimestamp,
    emitterAccountId,
    splitReceivers: metadata.recipients,
  });
}

async function upsertEcosystemMainAccount({
  ipfsHash,
  metadata,
  scopedLogger,
  blockNumber,
  transaction,
}: {
  ipfsHash: IpfsHash;
  blockNumber: number;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
}) {
  const accountId = convertToNftDriverId(metadata.describes.accountId);

  const values = {
    accountId,
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

  const [ecosystemMainAccount, isCreation] =
    await EcosystemMainAccountModel.findOrCreate({
      where: { accountId },
      defaults: {
        ...values,
        isValid: false, // Until the `SetSplits` event is processed.
      },
      transaction,
    });

  if (!isCreation) {
    scopedLogger.bufferUpdate({
      input: ecosystemMainAccount,
      id: ecosystemMainAccount.accountId,
      type: EcosystemMainAccountModel,
    });

    await ecosystemMainAccount.update(values, { transaction });
  } else {
    scopedLogger.bufferCreation({
      input: ecosystemMainAccount,
      id: ecosystemMainAccount.accountId,
      type: EcosystemMainAccountModel,
    });
  }
}

async function createNewSplitReceivers({
  splitReceivers,
  scopedLogger,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: {
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  splitReceivers: (
    | z.infer<typeof repoDriverSplitReceiverSchema>
    | z.infer<typeof subListSplitReceiverSchema>
  )[];
}) {
  const receiverPromises = splitReceivers.map(async (receiver) => {
    switch (receiver.type) {
      case 'repoDriver':
        assertIsRepoDriverId(receiver.accountId);
        return createSplitReceiver({
          scopedLogger,
          transaction,
          blockTimestamp,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'ecosystem_main_account',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'project',
            relationshipType: 'ecosystem_receiver',
            weight: receiver.weight,
            blockTimestamp,
          },
        });

      case 'subList':
        assertIsImmutableSplitsDriverId(receiver.accountId);
        return createSplitReceiver({
          scopedLogger,
          transaction,
          blockTimestamp,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'ecosystem_main_account',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'sub_list',
            relationshipType: 'sub_list_link',
            weight: receiver.weight,
            blockTimestamp,
          },
        });

      default:
        return unreachableError(
          `Unhandled Ecosystem Main Account Split Receiver type: ${(receiver as any).type}`,
        );
    }
  });

  await Promise.all(receiverPromises);
}

function validateMetadata(
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
