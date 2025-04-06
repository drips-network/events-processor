/* eslint-disable no-param-reassign */
import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type LogManager from '../../../core/LogManager';
import type { ImmutableSplitsDriverId, IpfsHash } from '../../../core/types';
import { EcosystemMainAccountModel, SubListModel } from '../../../models';
import { convertToNftDriverId } from '../../../utils/accountIdUtils';
import { getImmutableSpitsDriverMetadata } from '../../../utils/metadataUtils';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import {
  createProjectReceiver,
  createSubListReceiver,
  createDripListReceiver,
  deleteExistingReceivers,
  createAddressReceiver,
} from '../receiversRepository';
import type {
  addressDriverSplitReceiverSchema,
  repoDriverSplitReceiverSchema,
} from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/sub-list/v1';
import type { dripListSplitReceiverSchema } from '../../../metadata/schemas/nft-driver/v2';
import verifyProjectSources from '../projectVerification';
import RecoverableError from '../../../utils/recoverableError';
import type { immutableSplitsDriverMetadataParser } from '../../../metadata/schemas';

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

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await verifySplitsReceivers(emitterAccountId, metadata.recipients);

  if (!areSplitsValid) {
    logManager.appendLog(
      `Skipped Drip List ${emitterAccountId} metadata processing: on-chain splits hash '${onChainSplitsHash}' does not match hash '${calculatedSplitsHash}' calculated from metadata.`,
    );

    return;
  }
  await verifyProjectSources(metadata.recipients);

  await validateRootAndParentExist(metadata, transaction);

  const subListProps = {
    id: emitterAccountId,
    parentEcosystemMainAccountId:
      metadata.parent.type === 'ecosystem'
        ? convertToNftDriverId(metadata.parent.accountId)
        : null,
    rootEcosystemMainAccountId:
      metadata.root.type === 'ecosystem'
        ? convertToNftDriverId(metadata.root.accountId)
        : null,
    lastProcessedIpfsHash: ipfsHash,
  };

  const [subList, isCreated] = await SubListModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: { id: emitterAccountId },
    defaults: {
      ...subListProps,
      isValid: false, // Until the related Sub List's metadata is processed.
    },
  });

  if (isCreated) {
    logManager.appendFindOrCreateLog(SubListModel, true, subList.id);
  } else {
    subList.set(subListProps);

    logManager.appendUpdateLog(subList, SubListModel, subList.id);

    await subList.save({ transaction });
  }

  await deleteExistingReceivers({
    for: {
      accountId: emitterAccountId,
      column: 'funderSubListId',
    },
    transaction,
  });

  await setNewReceivers({
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
        return createProjectReceiver({
          logManager,
          transaction,
          blockTimestamp,
          metadataReceiver: receiver,
          funder: {
            type: 'sub-list',
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
            type: 'sub-list',
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
            type: 'sub-list',
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
            type: 'sub-list',
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

async function validateRootAndParentExist(
  metadata: AnyVersion<typeof immutableSplitsDriverMetadataParser>,
  transaction: Transaction,
) {
  if (
    metadata.parent.type !== 'ecosystem' ||
    metadata.root.type !== 'ecosystem'
  ) {
    throw new Error('Sub Lists are currently only supported in Ecosystems.');
  }

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
