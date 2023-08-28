import type EventHandlerBase from '../common/EventHandlerBase';
import { EVENT_HANDLERS } from '../common/app-settings';
import type { DripsEventSignature } from '../common/types';

export default function getEventHandlerByFilterSignature<
  T extends DripsEventSignature,
>(filterSignature: T): EventHandlerBase<T> {
  const HandlerConstructor = EVENT_HANDLERS[filterSignature];

  if (!HandlerConstructor) {
    throw new Error(`No handler found for filter ${filterSignature}.`);
  }

  return new HandlerConstructor();
}
