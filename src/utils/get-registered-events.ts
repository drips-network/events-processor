import { EVENT_HANDLERS } from '../config/app-settings';
import type { SupportedFilterSignature } from '../common/types';

export default function getRegisteredEvents(): SupportedFilterSignature[] {
  return Object.keys(EVENT_HANDLERS) as SupportedFilterSignature[];
}
