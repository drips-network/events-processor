import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import { ZeroAddress } from 'ethers';
import type ScopedLogger from '../../../core/ScopedLogger';
import type {
  Address,
  AddressDriverId,
  IpfsHash,
  NftDriverId,
} from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import verifySplitsReceivers from '../verifySplitsReceivers';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/immutable-splits-driver/v1';
import { verifyProjectSources } from '../../../utils/projectUtils';
import {
  assertIsImmutableSplitsDriverId,
  calcParentRepoDriverId,
  convertToNftDriverId,
} from '../../../utils/accountIdUtils';
import { EcosystemMainAccountModel, ProjectModel } from '../../../models';
import appSettings from '../../../config/appSettings';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from '../receiversRepository';
import unreachableError from '../../../utils/unreachableError';
import {
  addressDriverContract,
  nftDriverContract,
} from '../../../core/contractClients';
import {
  decodeVersion,
  makeVersion,
} from '../../../utils/lastProcessedVersion';
import type { repoSubAccountDriverSplitReceiverSchema } from '../../../metadata/schemas/common/repoSubAccountDriverSplitReceiverSchema';

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

export default async function handleEcosystemMainAccountMetadata({
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
    metadata.recipients.filter((r) => r.type === 'repoSubAccountDriver'),
  );

  if (!areProjectsValid) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped Ecosystem Main Account ${emitterAccountId} metadata processing: ${message}`,
    );
  }

  // ✅ All checks passed, we can proceed with the processing.

  await upsertEcosystemMainAccount({
    ipfsHash,
    logIndex,
    metadata,
    scopedLogger,
    blockNumber,
    transaction,
  });

  deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    logIndex,
    blockNumber,
    transaction,
    scopedLogger,
    blockTimestamp,
    emitterAccountId,
    splitReceivers: metadata.recipients,
  });
}

async function upsertEcosystemMainAccount({
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
    lastProcessedIpfsHash: ipfsHash,
    isVisible:
      blockNumber > appSettings.visibilityThresholdBlockNumber &&
      'isVisible' in metadata
        ? metadata.isVisible
        : true,
    lastProcessedVersion: makeVersion(blockNumber, logIndex).toString(),
    color: 'color' in metadata ? metadata.color : null,
    avatar: 'avatar' in metadata ? metadata.avatar.emoji : null,
  };

  const [ecosystemMainAccount, isCreation] =
    await EcosystemMainAccountModel.findOrCreate({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: { accountId },
      defaults: {
        ...values,
        isValid: false, // Until the `SetSplits` event is processed.
        previousOwnerAddress: ZeroAddress as Address,
      },
    });

  if (!isCreation) {
    const newVersion = makeVersion(blockNumber, logIndex);
    const storedVersion = BigInt(ecosystemMainAccount.lastProcessedVersion);
    const { blockNumber: sb, logIndex: sl } = decodeVersion(storedVersion);

    if (newVersion < storedVersion) {
      scopedLogger.log(
        `Skipped Drip List ${accountId} stale 'AccountMetadata' event (${blockNumber}:${logIndex} ≤ lastProcessed ${sb}:${sl}).`,
      );

      return;
    }

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
  logIndex,
  blockNumber,
  transaction,
  scopedLogger,
  splitReceivers,
  blockTimestamp,
  emitterAccountId,
}: {
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: NftDriverId;
  splitReceivers: (
    | z.infer<typeof repoSubAccountDriverSplitReceiverSchema>
    | z.infer<typeof subListSplitReceiverSchema>
  )[];
}) {
  const receiverPromises = splitReceivers.map(async (receiver) => {
    switch (receiver.type) {
      case 'repoSubAccountDriver':
        // eslint-disable-next-line no-case-declarations
        const repoDriverId = await calcParentRepoDriverId(receiver.accountId);

        await ProjectModel.findOrCreate({
          transaction,
          lock: transaction.LOCK.UPDATE,
          where: {
            accountId: repoDriverId,
          },
          defaults: {
            accountId: repoDriverId,
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
            senderAccountType: 'ecosystem_main_account',
            receiverAccountId: repoDriverId,
            receiverAccountType: 'project',
            relationshipType: 'ecosystem_receiver',
            weight: receiver.weight,
            blockTimestamp,
            splitsToRepoDriverSubAccount: true,
          },
        });

      case 'subList':
        assertIsImmutableSplitsDriverId(receiver.accountId);
        return createSplitReceiver({
          scopedLogger,
          transaction,
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
      | z.infer<typeof repoSubAccountDriverSplitReceiverSchema>
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
