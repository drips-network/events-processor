import {
  Drips__factory,
  RepoDriver__factory,
  NftDriver__factory,
} from '../../contracts';
import type { NftDriver, Drips, RepoDriver } from '../../contracts';
import type { DripsContract, EventSignature } from '../common/types';
import { getNetworkSettings } from './getNetworkSettings';
import {
  isDripsEvent,
  isNftDriverEvent,
  isRepoDriverEvent,
} from './isEventOfContract';

export async function getDrips(): Promise<Drips> {
  const {
    provider,
    chainConfig: { drips },
  } = await getNetworkSettings();

  return Drips__factory.connect(drips.address as string, provider);
}

export async function getNftDriver(): Promise<NftDriver> {
  const {
    provider,
    chainConfig: { nftDriver },
  } = await getNetworkSettings();

  return NftDriver__factory.connect(nftDriver.address as string, provider);
}

export async function getRepoDriver(): Promise<RepoDriver> {
  const {
    provider,
    chainConfig: { repoDriver },
  } = await getNetworkSettings();

  return RepoDriver__factory.connect(repoDriver.address as string, provider);
}

export async function getContractDetails(
  eventSignature: EventSignature,
): Promise<
  | {
      name: 'drips';
      contract: Drips;
    }
  | {
      name: 'nftDriver';
      contract: NftDriver;
    }
  | {
      name: 'repoDriver';
      contract: RepoDriver;
    }
> {
  const drips = await getDrips();
  if (isDripsEvent(eventSignature, drips)) {
    return {
      contract: drips,
      name: 'drips',
    };
  }

  const nftDriver = await getNftDriver();
  if (isNftDriverEvent(eventSignature, nftDriver)) {
    return {
      contract: nftDriver,
      name: 'nftDriver',
    };
  }

  const repoDriver = await getRepoDriver();
  if (isRepoDriverEvent(eventSignature, repoDriver)) {
    return {
      contract: repoDriver,
      name: 'repoDriver',
    };
  }

  throw new Error(`No contract found for ${eventSignature} event.`);
}

export function getContractNameByAccountId(
  accountId: string | number | bigint,
): DripsContract {
  const accountIdAsBigInt = BigInt(accountId);

  if (accountIdAsBigInt < 0n || accountIdAsBigInt > 2n ** 256n - 1n) {
    throw new Error(
      `Could not get bits: ${accountId} is not a valid positive number within the range of a uint256.`,
    );
  }

  const mask = 2n ** 32n - 1n; // 32 bits mask

  const bits = (accountIdAsBigInt >> 224n) & mask; // eslint-disable-line no-bitwise

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
}
