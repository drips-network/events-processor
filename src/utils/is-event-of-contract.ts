import type {
  DripsContractEventSignature,
  DripsEventSignature,
  RepoDriverContractEventSignature,
} from '../common/types';
import type { getDrips, getRepoDriver } from './get-contract';

// TODO: refactor and add support for other contracts.
export function isDripsEvent(
  event: DripsEventSignature,
  drips: typeof getDrips extends (...args: any[]) => Promise<infer T>
    ? T
    : never,
): event is DripsContractEventSignature {
  try {
    return Boolean(drips.filters[event as keyof typeof drips.filters]);
  } catch (error) {
    return false;
  }
}

export function isRepoDriverEvent(
  event: DripsEventSignature,
  repoDriver: typeof getRepoDriver extends (...args: any[]) => Promise<infer T>
    ? T
    : never,
): event is RepoDriverContractEventSignature {
  try {
    return Boolean(
      repoDriver.filters[event as keyof typeof repoDriver.filters],
    );
  } catch (error) {
    return false;
  }
}
