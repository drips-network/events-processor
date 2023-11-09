import type { KnownAny } from '../core/types';
import type { EventHandlerConstructor, EventSignature } from './types';

const REGISTERED_EVENT_HANDLERS: Partial<{
  [T in EventSignature]: EventHandlerConstructor<T>;
}> = {};

export function registerEventHandler<T extends EventSignature>(
  eventSignature: T,
  handler: EventHandlerConstructor<T>,
) {
  REGISTERED_EVENT_HANDLERS[eventSignature] = handler as KnownAny;
}

export function getEventHandler(eventSignature: EventSignature) {
  const HandlerConstructor = REGISTERED_EVENT_HANDLERS[eventSignature];

  if (!HandlerConstructor) {
    throw new Error(`No handler found for filter ${eventSignature}.`);
  }

  return new HandlerConstructor();
}

export function getRegisteredEvents(): EventSignature[] {
  return Object.keys(REGISTERED_EVENT_HANDLERS) as EventSignature[];
}
