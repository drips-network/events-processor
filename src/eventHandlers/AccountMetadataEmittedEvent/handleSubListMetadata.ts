/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import LogManager from '../../core/LogManager';
import type {
  IpfsHash,
  ImmutableSplitsDriverId,
  NftDriverId,
} from '../../core/types';
import { DependencyType } from '../../core/types';
import type { immutableSplitsDriverMetadataParser } from '../../metadata/schemas';
import {
  SubListModel,
  AddressDriverSplitReceiverModel,
  DripListSplitReceiverModel,
  RepoDriverSplitReceiverModel,
  SubListSplitReceiverModel,
} from '../../models';
import { AddressDriverSplitReceiverType } from '../../models/AddressDriverSplitReceiverModel';
import {
  isRepoDriverId,
  isAddressDriverId,
  isNftDriverId,
  toNftDriverId,
  isImmutableSplitsDriverId,
} from '../../utils/accountIdUtils';
import { assertDependencyOfProjectType } from '../../utils/assert';
import getUserAddress from '../../utils/getAccountAddress';
import { getImmutableSpitsDriverMetadata } from '../../utils/metadataUtils';
import unreachableError from '../../utils/unreachableError';
import createDbEntriesForProjectDependency from './createDbEntriesForProjectDependency';
import validateSplitsReceivers from './splitsValidator';

type Params = {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  subListId: ImmutableSplitsDriverId;
};

export default async function handleSubListMetadata({
  ipfsHash,
  subListId,
  logManager,
  transaction,
  blockTimestamp,
}: Params) {
  const subList = await SubListModel.findByPk(subListId, {
    transaction,
    lock: true,
  });

  if (!subList) {
    throw new Error(
      `Failed to update metadata for Sub List with ID ${subListId}: Sub List not found.
      \r Possible reasons:
      \r\t - The event that should have created the Sub List was not processed yet.
      \r\t - The metadata were manually emitted for a Sub List that does not exist in the app.`,
    );
  }

  const metadata = await getImmutableSpitsDriverMetadata(ipfsHash);

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await validateSplitsReceivers(subList.id, metadata.recipients);

  // If we reach this point, it means that the processed `AccountMetadataEmitted` event is the latest in the DB.
  // But we still need to check if the splits are the latest on-chain.
  // There is no need to process the metadata if the splits are not the latest on-chain.

  if (!areSplitsValid) {
    logManager.appendLog(
      `Skipping metadata update for Sub List with ID ${subListId} because the splits receivers hashes from the contract and the metadata do not match:
      \r\t - On-chain splits receivers hash: ${onChainSplitsHash}
      \r\t - Metadata splits receivers hash: ${calculatedSplitsHash}
      \r Possible reasons:
      \r\t - The metadata were the latest in the DB but not on-chain.
      \r\t - The metadata were manually emitted with different splits than the latest on-chain.`,
    );

    return;
  }

  if (subList.dataValues.parentAccountId !== metadata.parent.accountId) {
    throw new Error(
      `Sub List with ID ${subListId} has a different on-chain parent account ID than the metadata. Expected: '${subList.dataValues.parentAccountId}', got: '${metadata.parent.accountId}'`,
    );
  }

  await updateSubListMetadata(
    subList,
    logManager,
    transaction,
    metadata,
    ipfsHash,
  );

  await createDbEntriesForSubListSplits(
    toNftDriverId(metadata.parent.accountId),
    metadata.recipients,
    logManager,
    transaction,
    blockTimestamp,
  );
}

async function updateSubListMetadata(
  subList: SubListModel,
  logManager: LogManager,
  transaction: Transaction,
  metadata: AnyVersion<typeof immutableSplitsDriverMetadataParser>,
  metadataIpfsHash: IpfsHash,
): Promise<void> {
  subList.parentAccountId = toNftDriverId(metadata.parent.accountId);
  subList.lastProcessedIpfsHash = metadataIpfsHash;

  logManager.appendUpdateLog(subList, SubListModel, subList.id);

  await subList.save({ transaction });
}

async function createDbEntriesForSubListSplits(
  funderEcosystemId: NftDriverId,
  splits: AnyVersion<typeof immutableSplitsDriverMetadataParser>['recipients'],
  logManager: LogManager,
  transaction: Transaction,
  blockTimestamp: Date,
) {
  await clearCurrentProjectSplits(funderEcosystemId, transaction);

  const splitsPromises = splits.map(async (dependency) => {
    if (isRepoDriverId(dependency.accountId)) {
      assertDependencyOfProjectType(dependency);

      return createDbEntriesForProjectDependency(
        {
          type: 'ecosystem',
          accountId: funderEcosystemId,
        },
        dependency,
        transaction,
        blockTimestamp,
      );
    }

    if (isAddressDriverId(dependency.accountId)) {
      return AddressDriverSplitReceiverModel.create(
        {
          funderEcosystemId,
          weight: dependency.weight,
          fundeeAccountId: dependency.accountId,
          fundeeAccountAddress: getUserAddress(dependency.accountId),
          type: AddressDriverSplitReceiverType.EcosystemDependency,
          blockTimestamp,
        },
        { transaction },
      );
    }

    if (isNftDriverId(dependency.accountId)) {
      return DripListSplitReceiverModel.create(
        {
          funderEcosystemId,
          fundeeDripListId: dependency.accountId,
          weight: dependency.weight,
          type: DependencyType.EcosystemDependency,
          blockTimestamp,
        },
        { transaction },
      );
    }

    if (isImmutableSplitsDriverId(dependency.accountId)) {
      return SubListSplitReceiverModel.create(
        {
          funderEcosystemId,
          fundeeImmutableSplitsId: dependency.accountId,
          weight: dependency.weight,
          type: DependencyType.EcosystemDependency,
          blockTimestamp,
        },
        { transaction },
      );
    }

    return unreachableError(
      `Dependency with account ID ${dependency.accountId} is not an Address nor a Git Project.`,
    );
  });

  const result = await Promise.all(splitsPromises);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(
      SubListModel,
    )} with ID ${funderEcosystemId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
  );
}

async function clearCurrentProjectSplits(
  funderEcosystemId: string,
  transaction: Transaction,
) {
  await AddressDriverSplitReceiverModel.destroy({
    where: {
      funderEcosystemId,
    },
    transaction,
  });
  await RepoDriverSplitReceiverModel.destroy({
    where: {
      funderEcosystemId,
    },
    transaction,
  });
  await DripListSplitReceiverModel.destroy({
    where: {
      funderEcosystemId,
    },
    transaction,
  });
  await SubListSplitReceiverModel.destroy({
    where: {
      funderEcosystemId,
    },
    transaction,
  });
}
