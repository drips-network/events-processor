import {
  Drips__factory,
  type Drips,
  type RepoDriver,
  RepoDriver__factory,
} from '../../contracts';
import type {
  SupportedContractName,
  SupportedFilterSignature,
} from '../common/types';
import { getNetworkSettings } from './get-network-settings';
import { isDripsEvent, isRepoDriverEvent } from './is-event-of-contract';

export async function getDrips(): Promise<Drips> {
  const {
    provider,
    chainConfig: { drips },
  } = await getNetworkSettings();

  return Drips__factory.connect(drips.address, provider);
}

export async function getRepoDriver(): Promise<RepoDriver> {
  const {
    provider,
    chainConfig: { repoDriver },
  } = await getNetworkSettings();

  return RepoDriver__factory.connect(repoDriver.address, provider);
}

export async function getContractInfoByFilterSignature(
  filterSignature: SupportedFilterSignature,
): Promise<
  | {
      name: 'drips';
      contract: Drips;
    }
  | {
      name: 'repoDriver';
      contract: RepoDriver;
    }
> {
  // TODO: add support for other contracts.
  const drips = await getDrips();
  if (isDripsEvent(filterSignature, drips)) {
    return {
      contract: drips,
      name: 'drips',
    };
  }

  const repoDriver = await getRepoDriver();
  if (isRepoDriverEvent(filterSignature, repoDriver)) {
    return {
      contract: repoDriver,
      name: 'repoDriver',
    };
  }

  throw new Error(`No contract found for filter ${filterSignature}.`);
}

export const getContractNameByAccountId = (
  accountId: string | number | bigint,
): SupportedContractName => {
  const accountIdAsBigInt = BigInt(accountId);

  if (accountIdAsBigInt < 0n || accountIdAsBigInt > 2n ** 256n - 1n) {
    throw new Error(
      `Could not get bits: ${accountId} is not a valid positive number within the range of a uint256.`,
    );
  }

  const mask = 2n ** 32n - 1n; // 32 bits mask

  // eslint-disable-next-line no-bitwise
  const bits = (accountIdAsBigInt >> 224n) & mask; // shift right to bring the first 32 bits to the end and apply the mask

  switch (bits) {
    case 0n:
      return 'addressDriver';
    case 1n:
      return 'nftDriver';
    case 2n:
      return 'immutableSplitsDriver';
    case 3n:
      return 'repoDriver';
    default:
      throw new Error(`Unknown driver for accountId: ${accountId}.`);
  }
};
