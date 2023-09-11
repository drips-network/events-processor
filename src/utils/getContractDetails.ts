import type { Drips, NftDriver, RepoDriver } from '../../contracts';
import type { EventSignature } from '../common/types';
import { isDripsEvent, isNftDriverEvent, isRepoDriverEvent } from './assert';
import { getDrips, getNftDriver, getRepoDriver } from './getContractClient';
import shouldNeverHappen from './shouldNeverHappen';

export default async function getContractDetails(
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
      contract: await getDrips(),
      name: 'drips',
    };
  }

  if (isNftDriverEvent(eventSignature)) {
    return {
      contract: await getNftDriver(),
      name: 'nftDriver',
    };
  }

  if (isRepoDriverEvent(eventSignature)) {
    return {
      contract: await getRepoDriver(),
      name: 'repoDriver',
    };
  }

  throw shouldNeverHappen(`No contract found for ${eventSignature} event.`);
}
