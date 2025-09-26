/* eslint-disable no-param-reassign */
import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type ScopedLogger from '../../../core/ScopedLogger';
import type { ImmutableSplitsDriverId, IpfsHash } from '../../../core/types';
import {
  EcosystemMainAccountModel,
  ProjectModel,
  SubListModel,
} from '../../../models';
import { getImmutableSpitsDriverMetadata } from '../../../utils/metadataUtils';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import type { addressDriverSplitReceiverSchema } from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/immutable-splits-driver/v1';
import type { dripListSplitReceiverSchema } from '../../../metadata/schemas/nft-driver/v2';
import RecoverableError from '../../../utils/recoverableError';
import type { immutableSplitsDriverMetadataParser } from '../../../metadata/schemas';
import {
  ensureProjectExists,
  verifyProjectSources,
} from '../../../utils/projectUtils';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from '../receiversRepository';
import { METADATA_RECEIVER_TYPE_TO_ACCOUNT_TYPE } from '../../../core/splitRules';
import {
  assertIsAddressDiverId,
  assertIsImmutableSplitsDriverId,
  assertIsNftDriverId,
  assertIsRepoDeadlineDriverId,
  calcParentRepoDriverId,
  convertToAccountId,
  convertToImmutableSplitsDriverId,
} from '../../../utils/accountIdUtils';
import { makeVersion } from '../../../utils/lastProcessedVersion';
import type { repoSubAccountDriverSplitReceiverSchema } from '../../../metadata/schemas/common/repoSubAccountDriverSplitReceiverSchema';
import type { gitHubSourceSchema } from '../../../metadata/schemas/common/sources';
import { ensureLinkedIdentityExists } from '../../../utils/linkedIdentityUtils';
import type { deadlineSplitReceiverSchema } from '../../../metadata/schemas/repo-driver/v6';
import {
  ensureDeadlineExists,
  normalizeDeadlineReceiver,
  verifyDeadlineReceiver,
} from '../../../utils/deadlineUtils';

type Params = {
  logIndex: number;
  blockNumber: number;
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  emitterAccountId: ImmutableSplitsDriverId;
  transaction: Transaction;
};

export default async function handleSubListMetadata({
  ipfsHash,
  logIndex,
  blockNumber,
  scopedLogger,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: Params) {
  const metadata = await getImmutableSpitsDriverMetadata(ipfsHash);

  if (
    metadata.parent.type !== 'ecosystem' ||
    metadata.root.type !== 'ecosystem'
  ) {
    scopedLogger.bufferMessage(
      `🚨 Skipped Sub-List metadata processing: parent and root must be of type 'ecosystem'.`,
    );

    return;
  }

  const { isMatch, actualHash, onChainHash } = await verifySplitsReceivers(
    emitterAccountId,
    metadata.recipients,
  );

  if (!isMatch) {
    scopedLogger.bufferMessage(
      `🚨 Skipped Sub-List metadata processing: on-chain splits hash '${onChainHash}' does not match '${actualHash}' calculated from metadata.`,
    );

    return;
  }

  const verificationResult = await verifyProjectSources(
    metadata.recipients.filter(
      (r): r is typeof r & { source: z.infer<typeof gitHubSourceSchema> } =>
        r.type === 'repoSubAccountDriver' && r.source.forge !== 'orcid',
    ),
  );

  if (!verificationResult.isValid) {
    scopedLogger.bufferMessage(
      `🚨🕵️‍♂️ Skipped Sub-List metadata processing: ${verificationResult.message}`,
    );

    return;
  }

  await validateRootAndParentExist(metadata, transaction);

  // ✅ All checks passed, we can proceed with the processing.

  const subList = await upsertSubList({
    metadata,
    ipfsHash,
    scopedLogger,
    transaction,
    emitterAccountId,
  });

  await deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    subList,
    logIndex,
    blockNumber,
    scopedLogger,
    transaction,
    blockTimestamp,
    emitterAccountId,
    receivers: metadata.recipients,
  });
}

async function upsertSubList({
  ipfsHash,
  metadata,
  scopedLogger,
  transaction,
  emitterAccountId,
}: {
  ipfsHash: IpfsHash;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  emitterAccountId: ImmutableSplitsDriverId;
  metadata: AnyVersion<typeof immutableSplitsDriverMetadataParser>;
}): Promise<SubListModel> {
  const values = {
    accountId: emitterAccountId,
    parentAccountType:
      METADATA_RECEIVER_TYPE_TO_ACCOUNT_TYPE[metadata.parent.type],
    parentAccountId: convertToAccountId(metadata.parent.accountId),
    rootAccountType: METADATA_RECEIVER_TYPE_TO_ACCOUNT_TYPE[metadata.root.type],
    rootAccountId: convertToAccountId(metadata.root.accountId),
    lastProcessedIpfsHash: ipfsHash,
  };

  const accountId = convertToImmutableSplitsDriverId(emitterAccountId);

  const [subList, isCreation] = await SubListModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: { accountId },
    defaults: {
      ...values,
      isValid: false, // Until the `SetSplits` event is processed.
    },
  });

  if (!isCreation) {
    scopedLogger.bufferUpdate({
      input: subList,
      type: SubListModel,
      id: subList.accountId,
    });

    await subList.update(values, { transaction });
  } else {
    scopedLogger.bufferCreation({
      input: subList,
      type: SubListModel,
      id: subList.accountId,
    });
  }

  return subList;
}

async function createNewSplitReceivers({
  subList,
  logIndex,
  receivers,
  blockNumber,
  scopedLogger,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: {
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  subList: SubListModel;
  transaction: Transaction;
  scopedLogger: ScopedLogger;
  emitterAccountId: ImmutableSplitsDriverId;
  receivers: (
    | z.infer<typeof repoSubAccountDriverSplitReceiverSchema>
    | z.infer<typeof subListSplitReceiverSchema>
    | z.infer<typeof addressDriverSplitReceiverSchema>
    | z.infer<typeof dripListSplitReceiverSchema>
    | z.infer<typeof deadlineSplitReceiverSchema>
  )[];
}) {
  const receiverPromises = receivers.map(async (receiver) => {
    switch (receiver.type) {
      case 'repoSubAccountDriver': {
        const repoDriverId = await calcParentRepoDriverId(receiver.accountId);

        if (receiver.source.forge === 'orcid') {
          await ensureLinkedIdentityExists(
            repoDriverId,
            { blockNumber, logIndex },
            transaction,
            scopedLogger,
          );

          return createSplitReceiver({
            scopedLogger,
            transaction,
            splitReceiverShape: {
              senderAccountId: emitterAccountId,
              senderAccountType: 'sub_list',
              receiverAccountId: repoDriverId,
              receiverAccountType: 'linked_identity',
              relationshipType: 'sub_list_receiver',
              weight: receiver.weight,
              blockTimestamp,
              splitsToRepoDriverSubAccount:
                subList.rootAccountType === 'ecosystem_main_account'
                  ? true
                  : undefined,
            },
          });
        }

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
            senderAccountType: 'sub_list',
            receiverAccountId: repoDriverId,
            receiverAccountType: 'project',
            relationshipType: 'sub_list_receiver',
            weight: receiver.weight,
            blockTimestamp,
            splitsToRepoDriverSubAccount:
              subList.rootAccountType === 'ecosystem_main_account'
                ? true
                : undefined,
          },
        });
      }

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
            `🚨🕵️‍♂️ Cancelled Sub-List ${emitterAccountId} metadata processing: ${verificationResult.message}`,
          );

          throw new Error(
            `Cannot process Deadline receiver for Sub-List ${emitterAccountId}: ${verificationResult.message}`,
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
            senderAccountType: 'sub_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'deadline',
            relationshipType: 'sub_list_link',
            weight: receiver.weight,
            blockTimestamp,
          },
        });
      }

      case 'subList':
        assertIsImmutableSplitsDriverId(receiver.accountId);
        return createSplitReceiver({
          scopedLogger,
          transaction,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'sub_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'sub_list',
            relationshipType: 'sub_list_link',
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
            senderAccountType: 'sub_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'drip_list',
            relationshipType: 'sub_list_receiver',
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
            senderAccountType: 'sub_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'address',
            relationshipType: 'sub_list_receiver',
            weight: receiver.weight,
            blockTimestamp,
          },
        });

      default:
        return unreachableError(
          `Unhandled Sub-List Receiver type: ${(receiver as any).type}`,
        );
    }
  });

  await Promise.all(receiverPromises);
}

async function validateRootAndParentExist(
  metadata: AnyVersion<typeof immutableSplitsDriverMetadataParser>,
  transaction: Transaction,
) {
  const root = await EcosystemMainAccountModel.findByPk(
    metadata.root.accountId,
    {
      transaction,
      lock: transaction.LOCK.UPDATE,
    },
  );

  if (!root) {
    throw new RecoverableError(
      `Root Ecosystem Main Account '${metadata.root.accountId}' not found. Likely waiting on 'AccountMetadata' event to be processed. Retrying, but if this persists, it is a real error.`,
    );
  }

  const parent = await EcosystemMainAccountModel.findByPk(
    metadata.parent.accountId,
    {
      transaction,
      lock: transaction.LOCK.UPDATE,
    },
  );
  if (!parent) {
    throw new RecoverableError(
      `Parent Ecosystem Main Account '${metadata.parent.accountId}' not found. Likely waiting on 'AccountMetadata' event to be processed. Retrying, but if this persists, it is a real error.`,
    );
  }
}
