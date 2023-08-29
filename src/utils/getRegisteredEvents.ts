import { EVENT_HANDLERS } from '../common/app-settings';
import type { EventSignature } from '../common/types';

export default function getRegisteredEvents(): EventSignature[] {
  return Object.keys(EVENT_HANDLERS) as EventSignature[];
}
