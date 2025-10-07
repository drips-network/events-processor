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
import {
  ensureProjectExists,
  verifyProjectSources,
} from '../../../utils/projectUtils';
import DripListModel from '../../../models/DripListModel';
import {
  assertIsAddressDiverId,
  assertIsNftDriverId,
  assertIsRepoDeadlineDriverId,
  assertIsRepoDriverId,
  convertToNftDriverId,
} from '../../../utils/accountIdUtils';
import { makeVersion } from '../../../utils/lastProcessedVersion';
import {
  addressDriverContract,
  nftDriverContract,
} from '../../../core/contractClients';
import { ProjectModel } from '../../../models';
import { ensureLinkedIdentityExists } from '../../../utils/linkedIdentityUtils';
import {
  ensureDeadlineExists,
  normalizeDeadlineReceiver,
  verifyDeadlineReceiver,
} from '../../../utils/deadlineUtils';

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

type DripListReceiver = DripListMetadata['recipients'][number];
type LegacyReceiver = LegacyDripListMetadata['projects'][number];
type LegacyRepoReceiver = Extract<LegacyReceiver, { source: unknown }>;
type LegacyAddressReceiver = Exclude<LegacyReceiver, { source: unknown }>;

type NormalizedSplitReceiver =
  | DripListReceiver
  | (LegacyRepoReceiver & { type: 'repoDriver' })
  | (LegacyAddressReceiver & { type: 'address' });

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

  const splitReceivers: ReadonlyArray<DripListReceiver | LegacyReceiver> =
    // eslint-disable-next-line no-nested-ternary
    isDripListMetadata(metadata)
      ? metadata.recipients
      : isLegacyDripListMetadata(metadata)
        ? metadata.projects
        : [];

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

  const verificationResult = await verifyProjectSources(
    splitReceivers.filter(
      (
        splitReceiver,
      ): splitReceiver is typeof splitReceiver & { source: any } =>
        'source' in splitReceiver && splitReceiver.source.forge !== 'orcid',
    ),
  );

  if (!verificationResult.isValid) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped Drip List ${emitterAccountId} metadata processing: ${verificationResult.message}`,
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

  await deleteExistingSplitReceivers(emitterAccountId, transaction);

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
  const rawReceivers: ReadonlyArray<DripListReceiver | LegacyReceiver> =
    // eslint-disable-next-line no-nested-ternary
    isDripListMetadata(metadata)
      ? metadata.recipients
      : isLegacyDripListMetadata(metadata)
        ? metadata.projects
        : [];

  // 2. Upgrade legacy payloads so that *every* receiver object has a `type`.
  //    – v2+ entries already expose `type`.
  //    – v1 repo receivers carry a `source` property.
  const splitReceivers: ReadonlyArray<NormalizedSplitReceiver> =
    rawReceivers.map((receiver): NormalizedSplitReceiver => {
      if ('type' in receiver) {
        return receiver; // v6 or v2–v5.
      }

      // v1 without `type`.
      if ('source' in receiver) {
        // Legacy repo driver receiver.
        return { ...receiver, type: 'repoDriver' };
      }

      // Legacy address receiver.
      return { ...receiver, type: 'address' };
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
        await ensureLinkedIdentityExists(
          receiver.accountId,
          { blockNumber, logIndex },
          transaction,
          scopedLogger,
        );

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

        // Narrow down to project receiver.
        if (!('source' in receiver && receiver.source.forge === 'github')) {
          throw new Error(
            `Project receiver ${receiver.accountId} has invalid metadata shape: ${JSON.stringify(receiver)}`,
          );
        }

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

      case 'deadline': {
        assertIsRepoDeadlineDriverId(receiver.accountId);

        if (receiver.deadline <= blockTimestamp) {
          throw new Error(
            `Deadline receiver ${receiver.accountId} has deadline in the past: ${receiver.deadline.toISOString()}`,
          );
        }

        const normalizedDeadline = normalizeDeadlineReceiver(receiver);

        const verificationResult =
          await verifyDeadlineReceiver(normalizedDeadline);
        if (!verificationResult.isValid) {
          scopedLogger.bufferMessage(
            `🚨🕵️‍♂️ Cancelled Drip List ${emitterAccountId} metadata processing: ${verificationResult.message}`,
          );

          throw new Error(
            `Cannot process Deadline receiver for Drip List ${emitterAccountId}: ${verificationResult.message}`,
          );
        }

        await ensureProjectExists({
          project: normalizedDeadline.claimableProject,
          blockNumber,
          logIndex,
          transaction,
          scopedLogger,
        });

        await ensureDeadlineExists({
          deadline: normalizedDeadline,
          transaction,
          scopedLogger,
        });

        return createSplitReceiver({
          scopedLogger,
          transaction,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'drip_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'deadline',
            relationshipType: 'drip_list_receiver',
            weight: receiver.weight,
            blockTimestamp,
          },
        });
      }

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

type DripListMetadata = Extract<
  AnyVersion<typeof nftDriverAccountMetadataParser>,
  { type: 'dripList'; recipients: unknown }
>;

type LegacyDripListMetadata = Extract<
  AnyVersion<typeof nftDriverAccountMetadataParser>,
  { projects: unknown }
>;

function isDripListMetadata(
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): metadata is DripListMetadata {
  return 'recipients' in metadata && metadata.type === 'dripList';
}

function isLegacyDripListMetadata(
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): metadata is LegacyDripListMetadata {
  return 'projects' in metadata;
}
