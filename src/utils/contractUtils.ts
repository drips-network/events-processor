import type { Drips, NftDriver, RepoDriver } from '../../contracts';
import type { DripsContract } from '../common/types';
import type { EventSignature } from '../eventsConfiguration/types';
import {
  getDripsClient,
  getNftDriverClient,
  getRepoDriverClient,
} from './contractClientUtils';
import {
  isDripsEvent,
  isNftDriverEvent,
  isRepoDriverEvent,
} from './eventUtils';
import shouldNeverHappen from './shouldNeverHappen';

export function getOriginContractByAccountId(id: string): DripsContract {
  if (Number.isNaN(Number(id))) {
    throw new Error(`Could not get bits: ${id} is not a number.`);
  }

  const accountIdAsBigInt = BigInt(id);

  if (accountIdAsBigInt < 0n || accountIdAsBigInt > 2n ** 256n - 1n) {
    throw new Error(
      `Could not get bits: ${id} is not a valid positive number within the range of a uint256.`,
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
      throw new Error(`Unknown driver for ID ${id}.`);
  }
}

export async function getOriginContractByEvent(
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
  if (isDripsEvent(eventSignature)) {
    return {
      contract: await getDripsClient(),
      name: 'drips',
    };
  }

  if (isNftDriverEvent(eventSignature)) {
    return {
      contract: await getNftDriverClient(),
      name: 'nftDriver',
    };
  }

  if (isRepoDriverEvent(eventSignature)) {
    return {
      contract: await getRepoDriverClient(),
      name: 'repoDriver',
    };
  }

  throw shouldNeverHappen(`No contract found for ${eventSignature} event.`);
}
