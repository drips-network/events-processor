import { randomUUID } from 'crypto';
import { assertEventSignature } from '../utils/assert';
import eventProcessingQueue from './queue';
import type { EventSignature } from '../events/types';
import type EventHandlerRequest from '../events/EventHandlerRequest';

export default async function saveEventProcessingJob<T extends EventSignature>(
  request: EventHandlerRequest<T>,
  expectedEventSignature: T,
) {
  const {
    blockNumber,
    transactionHash,
    blockTimestamp,
    logIndex,
    args,
    eventSignature,
  } = request.event;

  assertEventSignature<T>(eventSignature, expectedEventSignature);

  return eventProcessingQueue
    .createJob({
      eventSignature,
      transactionHash,
      blockNumber,
      logIndex,
      blockTimestamp,
      args: JSON.stringify(args, (_, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }),
    })
    .setId(randomUUID())
    .retries(10)
    .backoff('exponential', 500)
    .save();
}
