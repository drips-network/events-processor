import type { KnownAny } from '../core/types';
import type EventHandlerBase from './EventHandlerBase';
import type { EventHandlerConstructor, EventSignature } from './types';

const REGISTERED_EVENT_HANDLERS: Partial<{
  [T in EventSignature]: EventHandlerBase<T>;
}> = {};

export function registerEventHandler<T extends EventSignature>(
  eventSignatures: T[] | T,
  Handler: EventHandlerConstructor<T>,
) {
  const eventSignaturesArray = Array.isArray(eventSignatures)
    ? eventSignatures
    : [eventSignatures];

  for (const eventSignature of eventSignaturesArray) {
    REGISTERED_EVENT_HANDLERS[eventSignature] = new Handler() as KnownAny;
  }
}

export function getHandlers() {
  return REGISTERED_EVENT_HANDLERS;
}

export function getEventHandler(eventSignature: EventSignature) {
  const handler = REGISTERED_EVENT_HANDLERS[eventSignature];

  if (!handler) {
    throw new Error(`No handler found for filter ${eventSignature}.`);
  }

  return handler;
}

export function getRegisteredEvents(): EventSignature[] {
  return Object.keys(REGISTERED_EVENT_HANDLERS) as EventSignature[];
}

export function isRegisteredEvent(i: string): i is EventSignature {
  return getRegisteredEvents().includes(i as EventSignature);
}
