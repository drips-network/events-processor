import type {
  DripsEventSignature,
  EventSignature,
  RepoDriverEventSignature,
} from '../common/types';
import type { getDrips, getRepoDriver } from './getContract';

// TODO: refactor and add support for other contracts.
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
