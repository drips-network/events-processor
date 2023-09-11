import type { DripsEvent, EventSignature } from '../common/types';
import { isDripsEvent, isNftDriverEvent, isRepoDriverEvent } from './assert';
import { getDrips, getNftDriver, getRepoDriver } from './getContractClient';
import shouldNeverHappen from './shouldNeverHappen';

export default async function getTypedEvent(
  eventSignature: EventSignature,
): Promise<DripsEvent> {
  if (isDripsEvent(eventSignature)) {
    const drips = await getDrips();
    return drips.filters[eventSignature];
  }

  if (isNftDriverEvent(eventSignature)) {
    const nftDriver = await getNftDriver();
    return nftDriver.filters[eventSignature];
  }

  if (isRepoDriverEvent(eventSignature)) {
    const repoDriver = await getRepoDriver();
    return repoDriver.filters[eventSignature];
  }

  return shouldNeverHappen(
    `No event found for filter signature ${eventSignature}.`,
  );
}
