import type { AnyVersion, LatestVersion } from '@efstajas/versioned-parser';
import type { UUID } from 'crypto';
import type { Transaction } from 'sequelize';
import appSettings from '../../config/appSettings';
import LogManager from '../../core/LogManager';
import type { IpfsHash, NftDriverId } from '../../core/types';
import { DependencyType } from '../../core/types';
import type { nftDriverAccountMetadataParser } from '../../metadata/schemas';
import {
  SubListSplitReceiverModel,
  RepoDriverSplitReceiverModel,
  EcosystemModel,
} from '../../models';
import { toImmutableSplitsDriverId } from '../../utils/accountIdUtils';
import { assertDependencyOfProjectType } from '../../utils/assert';
import unreachableError from '../../utils/unreachableError';
import createDbEntriesForProjectDependency from './createDbEntriesForProjectDependency';
import validateSplitsReceivers from './splitsValidator';

type Params = {
  ipfsHash: IpfsHash;
  blockNumber: number;
  blockTimestamp: Date;
  logManager: LogManager;
  ecosystemId: NftDriverId;
  transaction: Transaction;
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>;
};

export default async function handleEcosystemMetadata({
  ipfsHash,
  metadata,
  logManager,
  ecosystemId,
  blockNumber,
  transaction,
  blockTimestamp,
}: Params) {
  if (ecosystemId !== metadata.describes.accountId) {
    unreachableError(
      `Account ID mismatch with: got ${metadata.describes.accountId}, expected ${ecosystemId}`,
    );
  }

  if ('type' in metadata && metadata.type !== 'ecosystem') {
    unreachableError(
      `Metadata type mismatch with: got ${metadata.type}, expected 'ecosystem'`,
    );
  }

  if (!('recipients' in metadata)) {
    unreachableError(
      `Unsupported metadata version: missing 'recipients' field`,
    );
  }
  // This must be the only place an Ecosystem is created.
  const ecosystem = await EcosystemModel.create(
    {
      id: ecosystemId,
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
    .appendFindOrCreateLog(EcosystemModel, true, ecosystem.id)
    .logAllInfo();

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await validateSplitsReceivers(
      ecosystem.id,
      metadata.recipients.map((s) => ({
        weight: s.weight,
        accountId: s.accountId,
      })),
    );

  // If we reach this point, it means that the processed `AccountMetadataEmitted` event is the latest in the DB.
  // But we still need to check if the splits are the latest on-chain.
  // There is no need to process the metadata if the splits are not the latest on-chain.

  if (!areSplitsValid) {
    logManager.appendLog(
      `Skipping metadata update for Ecosystem with ID ${ecosystemId} because the splits receivers hashes from the contract and the metadata do not match:
      \r\t - On-chain splits receivers hash: ${onChainSplitsHash}
      \r\t - Metadata splits receivers hash: ${calculatedSplitsHash}
      \r Possible reasons:
      \r\t - The metadata were the latest in the DB but not on-chain.
      \r\t - The metadata were manually emitted with different splits than the latest on-chain.`,
    );

    return;
  }

  await createDbEntriesForEcosystemSplits({
    metadata,
    logManager,
    transaction,
    blockTimestamp,
    funderEcosystemId: ecosystemId,
  });
}

async function createDbEntriesForEcosystemSplits({
  metadata,
  logManager,
  transaction,
  blockTimestamp,
  funderEcosystemId,
}: {
  funderEcosystemId: NftDriverId;
  metadata: LatestVersion<typeof nftDriverAccountMetadataParser>;
  logManager: LogManager;
  transaction: Transaction;
  blockTimestamp: Date;
}) {
  await clearCurrentEcosystemSplits(funderEcosystemId, transaction);

  const splits = metadata.recipients;

  const splitsPromises = splits.map((split) => {
    if (split.type === 'repoDriver') {
      assertDependencyOfProjectType(split);

      return createDbEntriesForProjectDependency(
        {
          type: 'ecosystem',
          accountId: funderEcosystemId,
        },
        split,
        transaction,
        blockTimestamp,
      );
    }
    if (split.type === 'subList') {
      return SubListSplitReceiverModel.create(
        {
          funderEcosystemId,
          weight: split.weight,
          fundeeImmutableSplitsId: toImmutableSplitsDriverId(split.accountId),
          type: DependencyType.EcosystemDependency,
          blockTimestamp,
        },
        { transaction },
      );
    }
    return unreachableError(
      `Split with account ID ${split.accountId} is not a Project or an Ecosystem.`,
    );
  });

  const result = await Promise.all([...splitsPromises]);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(
      EcosystemModel,
    )} with ID ${funderEcosystemId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
      `,
  );
}

async function clearCurrentEcosystemSplits(
  funderEcosystemId: string,
  transaction: Transaction,
) {
  await RepoDriverSplitReceiverModel.destroy({
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
