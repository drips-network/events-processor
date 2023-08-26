import { EVENT_HANDLERS } from '../common/app-settings';
import type { DripsEventSignature } from '../common/types';

export default function getRegisteredEvents(): DripsEventSignature[] {
  return Object.keys(EVENT_HANDLERS) as DripsEventSignature[];
}
