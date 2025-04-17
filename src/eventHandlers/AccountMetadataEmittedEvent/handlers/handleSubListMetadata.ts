/* eslint-disable no-param-reassign */
import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type LogManager from '../../../core/LogManager';
import type { ImmutableSplitsDriverId, IpfsHash } from '../../../core/types';
import { EcosystemMainAccountModel, SubListModel } from '../../../models';
import { getImmutableSpitsDriverMetadata } from '../../../utils/metadataUtils';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import type {
  addressDriverSplitReceiverSchema,
  repoDriverSplitReceiverSchema,
} from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/immutable-splits-driver/v1';
import type { dripListSplitReceiverSchema } from '../../../metadata/schemas/nft-driver/v2';
import RecoverableError from '../../../utils/recoverableError';
import type { immutableSplitsDriverMetadataParser } from '../../../metadata/schemas';
import { verifyProjectSources } from '../../../utils/projectUtils';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from '../receiversRepository';
import { METADATA_RECEIVER_TYPE_TO_ACCOUNT_TYPE } from '../../../core/splitRules';
import {
  assertIsAddressDiverId,
  assertIsImmutableSplitsDriverId,
  assertIsNftDriverId,
  assertIsRepoDriverId,
  convertToAccountId,
} from '../../../utils/accountIdUtils';

type Params = {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  logManager: LogManager;
  emitterAccountId: ImmutableSplitsDriverId;
  transaction: Transaction;
};

export default async function handleSubListMetadata({
  ipfsHash,
  logManager,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: Params) {
  const metadata = await getImmutableSpitsDriverMetadata(ipfsHash);

  if (
    metadata.parent.type !== 'ecosystem' ||
    metadata.root.type !== 'ecosystem'
  ) {
    logManager.appendLog(
      `🚨 Skipped Sub-List metadata processing: parent and root must be of type 'ecosystem'.`,
    );

    return;
  }

  const { isMatch, actualHash, onChainHash } = await verifySplitsReceivers(
    emitterAccountId,
    metadata.recipients,
  );

  if (!isMatch) {
    logManager.appendLog(
      `🚨 Skipped Sub-List metadata processing: on-chain splits hash '${onChainHash}' does not match '${actualHash}' calculated from metadata.`,
    );

    return;
  }

  const { areProjectsValid, message } = await verifyProjectSources(
    metadata.recipients.filter((r) => r.type === 'repoDriver'),
  );

  if (!areProjectsValid) {
    logManager.appendLog(
      `🚨🕵️‍♂️ Skipped Sub-List metadata processing: ${message}`,
    );

    return;
  }

  await validateRootAndParentExist(metadata, transaction);

  // ✅ All checks passed, we can proceed with the processing.

  await upsertSubList({
    metadata,
    ipfsHash,
    logManager,
    transaction,
    emitterAccountId,
  });

  deleteExistingSplitReceivers(emitterAccountId, transaction);

  await createNewSplitReceivers({
    logManager,
    transaction,
    blockTimestamp,
    emitterAccountId,
    receivers: metadata.recipients,
  });
}

async function upsertSubList({
  ipfsHash,
  metadata,
  logManager,
  transaction,
  emitterAccountId,
}: {
  ipfsHash: IpfsHash;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: ImmutableSplitsDriverId;
  metadata: AnyVersion<typeof immutableSplitsDriverMetadataParser>;
}): Promise<void> {
  const [subList, isCreated] = await SubListModel.upsert(
    {
      accountId: emitterAccountId,
      parentAccountType:
        METADATA_RECEIVER_TYPE_TO_ACCOUNT_TYPE[metadata.parent.type],
      parentId: convertToAccountId(metadata.parent.accountId),
      rootAccountType:
        METADATA_RECEIVER_TYPE_TO_ACCOUNT_TYPE.ecosystem_main_account,
      rootId: convertToAccountId(metadata.root.accountId),
      lastProcessedIpfsHash: ipfsHash,
    },
    {
      transaction,
    },
  );

  logManager.appendUpsertLog(
    subList,
    SubListModel,
    subList.accountId,
    Boolean(isCreated),
  );
}

async function createNewSplitReceivers({
  receivers,
  logManager,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: ImmutableSplitsDriverId;
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
        assertIsRepoDriverId(receiver.accountId);
        return createSplitReceiver({
          logManager,
          transaction,
          blockTimestamp,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'sub_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'project',
            relationshipType: 'sub_list_receiver',
            weight: receiver.weight,
            blockTimestamp,
          },
        });

      case 'subList':
        assertIsImmutableSplitsDriverId(receiver.accountId);
        return createSplitReceiver({
          logManager,
          transaction,
          blockTimestamp,
          splitReceiverShape: {
            senderAccountId: emitterAccountId,
            senderAccountType: 'sub_list',
            receiverAccountId: receiver.accountId,
            receiverAccountType: 'sub_list',
            relationshipType: 'sub_list_receiver',
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
          logManager,
          transaction,
          blockTimestamp,
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
