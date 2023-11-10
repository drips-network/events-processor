/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import {
  DependencyType,
  type DripListId,
  type IpfsHash,
} from '../../../core/types';
import getNftDriverMetadata from '../../../utils/metadataUtils';
import validateDripListMetadata from './validateDripListMetadata';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../core/LogManager';
import {
  getOwnerAccountId,
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../../utils/accountIdUtils';
import { assertDependencyOfProjectType } from '../../../utils/assert';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  RepoDriverSplitReceiverModel,
  DripListSplitReceiverModel,
  TransferEventModel,
} from '../../../models';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import areReceiversValid from '../splitsValidator';
import getUserAddress from '../../../utils/getAccountAddress';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';

export default async function handleDripListMetadata(
  logManager: LogManager,
  dripListId: DripListId,
  transaction: Transaction,
  ipfsHash: IpfsHash,
) {
  const dripListTransferEvent = await TransferEventModel.findOne({
    transaction,
    lock: true,
    where: {
      tokenId: dripListId,
    },
  });

  if (!dripListTransferEvent) {
    throw new Error(
      `Cannot update metadata for Drip List with ID ${dripListId}: the original 'Transfer' event that minted the list on-chain does not exist in the database.`,
    );
  }

  const metadata = await getNftDriverMetadata(ipfsHash);

  await validateDripListMetadata(dripListTransferEvent, metadata);

  const { from, to } = dripListTransferEvent;

  const [dripList, isDripListCreated] = await DripListModel.findOrCreate({
    transaction,
    lock: true,
    where: {
      id: dripListId,
    },
    defaults: {
      id: dripListId,
      creator: to,
      isValid: await areReceiversValid(
        dripListId,
        metadata.projects.map((s) => ({
          weight: s.weight,
          accountId: s.accountId,
        })),
      ),
      name: metadata.name ?? null,
      description:
        'description' in metadata ? metadata.description || null : null,
      ownerAddress: to,
      ownerAccountId: await getOwnerAccountId(to),
      previousOwnerAddress: from,
    },
  });

  if (isDripListCreated) {
    logManager
      .appendFindOrCreateLog(DripListModel, isDripListCreated, dripList.id)
      .logAllDebug();
  } else {
    await updateDripListMetadata(dripList, logManager, transaction, metadata);
  }

  await createDbEntriesForDripListSplits(
    dripListId,
    metadata.projects,
    logManager,
    transaction,
  );
}

async function updateDripListMetadata(
  dripList: DripListModel,
  logManager: LogManager,
  transaction: Transaction,
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): Promise<void> {
  dripList.name = metadata.name ?? null;
  dripList.description =
    'description' in metadata ? metadata.description || null : null;

  const isValid = await areReceiversValid(
    dripList.id,
    metadata.projects.map((s) => ({
      weight: s.weight,
      accountId: s.accountId,
    })),
  );

  dripList.isValid = isValid;

  if (!isValid) {
    logManager.appendLog(
      `Set the Drip List to 'invalid' because the hash of the metadata receivers did not match the hash of the on-chain receivers for project with ID ${dripList.id}. 
      This means that the processed event was the latest in the database but not the latest on-chain. 
      Check the 'isValid' flag to see if the project is valid after all the events are processed.`,
    );
  }

  logManager.appendUpdateLog(dripList, DripListModel, dripList.id);

  await dripList.save({ transaction });
}

async function createDbEntriesForDripListSplits(
  funderDripListId: DripListId,
  splits: AnyVersion<typeof nftDriverAccountMetadataParser>['projects'],
  logManager: LogManager,
  transaction: Transaction,
) {
  await clearCurrentEntries(funderDripListId, transaction);

  const splitsPromises = splits.map((split) => {
    if (isRepoDriverId(split.accountId)) {
      assertDependencyOfProjectType(split);

      return createDbEntriesForProjectDependency(
        funderDripListId,
        split,
        transaction,
      );
    }

    if (isNftDriverId(split.accountId)) {
      return DripListSplitReceiverModel.create(
        {
          funderDripListId,
          fundeeDripListId: split.accountId,
          weight: split.weight,
          type: DependencyType.DripListDependency,
        },
        { transaction },
      );
    }

    if (isAddressDriverId(split.accountId)) {
      return AddressDriverSplitReceiverModel.create(
        {
          funderDripListId,
          weight: split.weight,
          fundeeAccountId: split.accountId,
          fundeeAccountAddress: getUserAddress(split.accountId),
          type: AddressDriverSplitReceiverType.DripListDependency,
        },
        { transaction },
      );
    }

    return shouldNeverHappen(
      `Split with account ID ${split.accountId} is not an Address, Drip List, or a Git Project.`,
    );
  });

  const result = await Promise.all([...splitsPromises]);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(
      DripListModel,
    )} with ID ${funderDripListId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
  );
}

async function clearCurrentEntries(
  funderDripListId: string,
  transaction: Transaction,
) {
  await AddressDriverSplitReceiverModel.destroy({
    where: {
      funderDripListId,
    },
    transaction,
  });
  await RepoDriverSplitReceiverModel.destroy({
    where: {
      funderDripListId,
    },
    transaction,
  });
  await DripListSplitReceiverModel.destroy({
    where: {
      funderDripListId,
    },
    transaction,
  });
}
