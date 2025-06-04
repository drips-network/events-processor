import type { EventData, EventSignature } from './types';

export default class EventHandlerRequest<T extends EventSignature> {
  public readonly id: string;
  public readonly event: EventData<T>;

  constructor(event: EventData<T>, id: string) {
    this.id = id;
    this.event = event;
  }
}
