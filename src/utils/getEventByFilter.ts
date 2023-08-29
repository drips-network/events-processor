import type { DripsEvent, EventSignature } from '../common/types';
import { getDrips, getRepoDriver } from './getContract';
import { isDripsEvent, isRepoDriverEvent } from './isEventOfContract';

export default async function getEventByFilterSignature(
  filterSignature: EventSignature,
): Promise<DripsEvent> {
  const drips = await getDrips();
  const repoDriver = await getRepoDriver();

  if (isDripsEvent(filterSignature, drips)) {
    return drips.filters[filterSignature];
  }

  if (isRepoDriverEvent(filterSignature, repoDriver)) {
    return repoDriver.filters[filterSignature];
  }

  throw new Error(`No event found for filter signature ${filterSignature}.`);
}
