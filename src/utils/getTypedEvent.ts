import type { DripsEvent, EventSignature } from '../common/types';
import { getDrips, getNftDriver, getRepoDriver } from './getContract';
import {
  isDripsEvent,
  isNftDriverEvent,
  isRepoDriverEvent,
} from './isEventOfContract';
import shouldNeverHappen from './shouldNeverHappen';

export default async function getTypedEvent(
  eventSignature: EventSignature,
): Promise<DripsEvent> {
  const drips = await getDrips();
  if (isDripsEvent(eventSignature, drips)) {
    return drips.filters[eventSignature];
  }

  const nftDriver = await getNftDriver();
  if (isNftDriverEvent(eventSignature, nftDriver)) {
    return nftDriver.filters[eventSignature];
  }

  const repoDriver = await getRepoDriver();
  if (isRepoDriverEvent(eventSignature, repoDriver)) {
    return repoDriver.filters[eventSignature];
  }

  return shouldNeverHappen(
    `No event found for filter signature ${eventSignature}.`,
  );
}
