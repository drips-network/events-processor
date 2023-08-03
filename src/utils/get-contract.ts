import {
  Drips__factory,
  type Drips,
  type RepoDriver,
  RepoDriver__factory,
} from '../../contracts';
import type { SupportedFilterSignature } from '../common/types';
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
