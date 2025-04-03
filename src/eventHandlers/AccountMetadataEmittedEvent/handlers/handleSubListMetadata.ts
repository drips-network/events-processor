/* eslint-disable no-param-reassign */
import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import LogManager from '../../../core/LogManager';
import type { ImmutableSplitsDriverId, IpfsHash } from '../../../core/types';
import {
  AccountMetadataEmittedEventModel,
  SubListModel,
} from '../../../models';
import {
  toNftDriverId,
  toImmutableSplitsDriverId,
} from '../../../utils/accountIdUtils';
import { getImmutableSpitsDriverMetadata } from '../../../utils/metadataUtils';
import unreachableError from '../../../utils/unreachableError';
import verifySplitsReceivers from '../verifySplitsReceivers';
import { isLatestEvent } from '../../../utils/eventUtils';
import verifyProjectSources from '../projectVerification';
import type {
  addressDriverSplitReceiverSchema,
  repoDriverSplitReceiverSchema,
} from '../../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../../metadata/schemas/sub-list/v1';
import type { dripListSplitReceiverSchema } from '../../../metadata/schemas/nft-driver/v2';
import {
  createProjectAndProjectReceiver,
  createSubListReceiver,
  createDripListReceiver,
  deleteExistingReceivers,
  createAddressReceiver,
} from '../receiversRepository';

type Params = {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  logManager: LogManager;
  subListId: ImmutableSplitsDriverId;
  transaction: Transaction;
  originEventDetails: {
    entity: AccountMetadataEmittedEventModel;
    logIndex: number;
    transactionHash: string;
  };
};

export default async function handleSubListMetadata({
  ipfsHash,
  logManager,
  subListId,
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
        accountId: subListId,
      },
      transaction,
    ))
  ) {
    logManager.logAllInfo();

    return;
  }
  logManager.appendIsLatestEventLog();

  const metadata = await getImmutableSpitsDriverMetadata(ipfsHash);

  // Here, is the only place an Ecosystem is created.
  const subList = await SubListModel.create(
    {
      id: subListId,
      parentDripListId:
        metadata.parent.type === 'drip-list'
          ? toNftDriverId(metadata.parent.accountId)
          : null,
      parentEcosystemId:
        metadata.parent.type === 'ecosystem'
          ? toNftDriverId(metadata.parent.accountId)
          : null,
      parentSubListId:
        metadata.parent.type === 'sub-list'
          ? toImmutableSplitsDriverId(metadata.parent.accountId)
          : null,
      rootDripListId:
        metadata.root.type === 'drip-list'
          ? toNftDriverId(metadata.root.accountId)
          : null,
      rootEcosystemId:
        metadata.root.type === 'ecosystem'
          ? toNftDriverId(metadata.root.accountId)
          : null,
      lastProcessedIpfsHash: ipfsHash,
    },
    { transaction },
  );

  logManager.appendFindOrCreateLog(SubListModel, true, subList.id).logAllInfo();

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await verifySplitsReceivers(subList.id, metadata.recipients);

  if (!areSplitsValid) {
    logManager.appendLog(
      [
        `Skipping metadata update for Sub List ${subListId} due to mismatch in splits hash.`,
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
      accountId: subListId,
      column: 'funderSubListId',
    },
    transaction,
  });

  await setNewReceivers({
    logManager,
    transaction,
    blockTimestamp,
    funderSubListId: subListId,
    receivers: metadata.recipients,
  });
}

async function setNewReceivers({
  receivers,
  logManager,
  transaction,
  blockTimestamp,
  funderSubListId,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  funderSubListId: ImmutableSplitsDriverId;
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
            type: 'sub-list',
            accountId: funderSubListId,
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
            accountId: funderSubListId,
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
            accountId: funderSubListId,
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
            accountId: funderSubListId,
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
      SubListModel,
    )} with ID ${funderSubListId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
  );
}
