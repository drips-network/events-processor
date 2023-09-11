import type {
  DripsEventSignature,
  EventSignature,
  NftDriverEventSignature,
  RepoDriverEventSignature,
} from '../common/types';
import type { getDrips, getNftDriver, getRepoDriver } from './getContract';

// TODO: refactor and add support for other contracts.
// TODO:  const s = eventLog.interface.hasEvent('OwnerUpdated(uint256,address)');
export function isDripsEvent(
  event: EventSignature,
  drips: typeof getDrips extends (...args: any[]) => Promise<infer T>
    ? T
    : never,
): event is DripsEventSignature {
  try {
    return Boolean(drips.filters[event as keyof typeof drips.filters]);
  } catch (error) {
    return false;
  }
}

export function isNftDriverEvent(
  event: EventSignature,
  nftDriver: typeof getNftDriver extends (...args: any[]) => Promise<infer T>
    ? T
    : never,
): event is NftDriverEventSignature {
  try {
    return Boolean(nftDriver.filters[event as keyof typeof nftDriver.filters]);
  } catch (error) {
    return false;
  }
}

export function isRepoDriverEvent(
  event: EventSignature,
  repoDriver: typeof getRepoDriver extends (...args: any[]) => Promise<infer T>
    ? T
    : never,
): event is RepoDriverEventSignature {
  try {
    return Boolean(
      repoDriver.filters[event as keyof typeof repoDriver.filters],
    );
  } catch (error) {
    return false;
  }
}
