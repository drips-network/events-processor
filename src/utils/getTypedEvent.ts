import type { DripsEvent, EventSignature } from '../common/types';
import { getDrips, getRepoDriver } from './getContract';
import { isDripsEvent, isRepoDriverEvent } from './isEventOfContract';

export default async function getTypedEvent(
  eventSignature: EventSignature,
): Promise<DripsEvent> {
  const drips = await getDrips();
  const repoDriver = await getRepoDriver();

  if (isDripsEvent(eventSignature, drips)) {
    return drips.filters[eventSignature];
  }

  if (isRepoDriverEvent(eventSignature, repoDriver)) {
    return repoDriver.filters[eventSignature];
  }

  throw new Error(`No event found for filter signature ${eventSignature}.`);
}
