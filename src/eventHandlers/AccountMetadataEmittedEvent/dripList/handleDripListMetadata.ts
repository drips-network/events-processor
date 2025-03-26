/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import { toBigInt } from 'ethers';
import type { IpfsHash, NftDriverId } from '../../../core/types';
import { DependencyType } from '../../../core/types';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../core/LogManager';
import {
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
  toAddressDriverId,
  toImmutableSplitsDriverId,
  toNftDriverId,
} from '../../../utils/accountIdUtils';
import { assertDependencyOfProjectType } from '../../../utils/assert';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  RepoDriverSplitReceiverModel,
  DripListSplitReceiverModel,
  SubListSplitReceiverModel,
} from '../../../models';
import unreachableError from '../../../utils/unreachableError';
import validateSplitsReceivers from '../splitsValidator';
import getUserAddress from '../../../utils/getAccountAddress';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import appSettings from '../../../config/appSettings';

type Params = {
  ipfsHash: IpfsHash;
  blockNumber: number;
  blockTimestamp: Date;
  logManager: LogManager;
  dripListId: NftDriverId;
  transaction: Transaction;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
};

export default async function handleDripListMetadata({
  ipfsHash,
  metadata,
  logManager,
  dripListId,
  blockNumber,
  transaction,
  blockTimestamp,
}: Params) {
  if (dripListId !== metadata.describes.accountId) {
    unreachableError(
      `Account ID mismatch with: got ${metadata.describes.accountId}, expected ${dripListId}`,
    );
  }

  if ('type' in metadata.describes && metadata.describes.type !== 'dripList') {
    unreachableError(
      `Metadata type mismatch with: got ${metadata.describes.type}, expected a Drip List`,
    );
  }

  // This must be the only place a Drip List is created.
  const dripList = await DripListModel.create(
    {
      id: dripListId,
      isValid: false,
      name: metadata.name ?? null,
      description:
        'description' in metadata ? metadata.description || null : null,
      latestVotingRoundId:
        'latestVotingRoundId' in metadata
          ? (metadata.latestVotingRoundId as UUID) || null
          : null,
      lastProcessedIpfsHash: ipfsHash,
      isVisible:
        blockNumber > appSettings.visibilityThresholdBlockNumber &&
        'isVisible' in metadata
          ? metadata.isVisible
          : true,
    },
    { transaction },
  );

  logManager
    .appendFindOrCreateLog(DripListModel, true, dripList.id)
    .logAllInfo();

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

  await createDbEntriesForDripListSplits({
    metadata,
    logManager,
    transaction,
    blockTimestamp,
    funderDripListId: dripListId,
  });
}

async function createDbEntriesForDripListSplits({
  metadata,
  logManager,
  transaction,
  blockTimestamp,
  funderDripListId,
}: {
  funderDripListId: NftDriverId;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
  logManager: LogManager;
  transaction: Transaction;
  blockTimestamp: Date;
}) {
  await clearCurrentProjectSplits(funderDripListId, transaction);

  if (metadata.projects) {
    // Legacy metadata version.
    const splits = metadata.projects;
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
            blockTimestamp,
          },
          { transaction },
        );
      }

      return unreachableError(
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
  } else if ('recipients' in metadata) {
    // Current metadata version.
    const splits = metadata.recipients;

    const splitsPromises = splits.map((split) => {
      if (split.type === 'repoDriver') {
        assertDependencyOfProjectType(split);

        return createDbEntriesForProjectDependency(
          funderDripListId,
          split,
          transaction,
          blockTimestamp,
        );
      }
      if (split.type === 'dripList') {
        return DripListSplitReceiverModel.create(
          {
            funderDripListId,
            fundeeDripListId: toNftDriverId(toBigInt(split.accountId)),
            weight: split.weight,
            type: DependencyType.DripListDependency,
            blockTimestamp,
          },
          { transaction },
        );
      }
      if (split.type === 'address') {
        return AddressDriverSplitReceiverModel.create(
          {
            funderDripListId,
            weight: split.weight,
            fundeeAccountId: toAddressDriverId(split.accountId),
            fundeeAccountAddress: getUserAddress(split.accountId),
            type: AddressDriverSplitReceiverType.DripListDependency,
            blockTimestamp,
          },
          { transaction },
        );
      }

      return SubListSplitReceiverModel.create(
        {
          funderDripListId,
          weight: split.weight,
          fundeeImmutableSplitsId: toImmutableSplitsDriverId(split.accountId),
          type: DependencyType.DripListDependency,
          blockTimestamp,
        },
        { transaction },
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
  } else {
    unreachableError(
      `Metadata does not contain 'projects' or 'recipients' field.`,
    );
  }
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
  await SubListSplitReceiverModel.destroy({
    where: {
      funderDripListId,
    },
    transaction,
  });
}
