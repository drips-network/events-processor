import type { SupportedEvent, SupportedFilterSignature } from '../common/types';
import { getDrips, getRepoDriver } from './get-contract';
import { isDripsEvent, isRepoDriverEvent } from './is-event-of-contract';

export default async function getEventByFilterSignature(
  filterSignature: SupportedFilterSignature,
): Promise<SupportedEvent> {
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
