/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
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
} from '../../../models';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import validateSplitsReceivers from '../splitsValidator';
import getUserAddress from '../../../utils/getAccountAddress';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';

export default async function handleDripListMetadata(
  logManager: LogManager,
  dripListId: DripListId,
  transaction: Transaction,
  ipfsHash: IpfsHash,
  blockTimestamp: Date,
) {
  const dripList = await DripListModel.findByPk(dripListId, {
    transaction,
    lock: true,
  });

  if (!dripList) {
    throw new Error(
      `Failed to update metadata for Drip List with ID ${dripListId}: Drip List not found.
      \r Possible reasons:
      \r\t - The event that should have created the Drip List was not processed yet.
      \r\t - The metadata were manually emitted for a Drip List that does not exist in the app.`,
    );
  }

  const metadata = await getNftDriverMetadata(ipfsHash);

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await validateSplitsReceivers(
      dripList.id,
      metadata.projects.map((s) => ({
        weight: s.weight,
        accountId: s.accountId,
      })),
    );

  // If we reach this point, it means that the processed `AccountMetadataEmitted` event is the latest in the DB.
  // But we still need to check if the splits are the latest on-chain.
  // There is no need to process the metadata if the splits are not the latest on-chain.

  if (!areSplitsValid) {
    logManager.appendLog(
      `Skipping metadata update for Drip List with ID ${dripListId} because the splits receivers hashes from the contract and the metadata do not match:
      \r\t - On-chain splits receivers hash: ${onChainSplitsHash}
      \r\t - Metadata splits receivers hash: ${calculatedSplitsHash}
      \r Possible reasons:
      \r\t - The metadata were the latest in the DB but not on-chain.
      \r\t - The metadata were manually emitted with different splits than the latest on-chain.`,
    );

    return;
  }

  await validateDripListMetadata(dripList, metadata);

  await updateDripListMetadata(dripList, logManager, transaction, metadata);

  await createDbEntriesForDripListSplits(
    dripListId,
    metadata.projects,
    logManager,
    transaction,
    blockTimestamp,
  );
}

async function updateDripListMetadata(
  dripList: DripListModel,
  logManager: LogManager,
  transaction: Transaction,
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): Promise<void> {
  dripList.isValid = true;
  dripList.name = metadata.name ?? null;
  dripList.description =
    'description' in metadata ? metadata.description || null : null;
  dripList.latestVotingRoundId =
    'latestVotingRoundId' in metadata
      ? (metadata.latestVotingRoundId as UUID) || null
      : null;

  logManager.appendUpdateLog(dripList, DripListModel, dripList.id);

  await dripList.save({ transaction });
}

async function createDbEntriesForDripListSplits(
  funderDripListId: DripListId,
  splits: AnyVersion<typeof nftDriverAccountMetadataParser>['projects'],
  logManager: LogManager,
  transaction: Transaction,
  blockTimestamp: Date,
) {
  await clearCurrentProjectSplits(funderDripListId, transaction);

  const splitsPromises = splits.map((split) => {
    if (isRepoDriverId(split.accountId)) {
      assertDependencyOfProjectType(split);

      return createDbEntriesForProjectDependency(
        funderDripListId,
        split,
        transaction,
        blockTimestamp,
      );
    }

    if (isNftDriverId(split.accountId)) {
      return DripListSplitReceiverModel.create(
        {
          funderDripListId,
          fundeeDripListId: split.accountId,
          weight: split.weight,
          type: DependencyType.DripListDependency,
          blockTimestamp,
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

async function clearCurrentProjectSplits(
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
