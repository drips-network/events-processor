import { EVENT_HANDLERS } from '../common/app-settings';
import type { SupportedFilterSignature } from '../common/types';

export default function getRegisteredEvents(): SupportedFilterSignature[] {
  return Object.keys(EVENT_HANDLERS) as SupportedFilterSignature[];
}
