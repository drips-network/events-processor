import type { UUID } from 'crypto';
import { randomUUID } from 'crypto';
import type { EventData, EventSignature } from './types';

export default class EventHandlerRequest<T extends EventSignature> {
  public readonly id: UUID;
  public readonly event: EventData<T>;

  constructor(event: EventData<T>, id: UUID = randomUUID()) {
    this.id = id;
    this.event = event;
  }
}
