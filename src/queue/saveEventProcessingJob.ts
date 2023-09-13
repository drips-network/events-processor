import { randomUUID } from 'crypto';
import type { TypedEventLog } from '../../contracts/common';
import { assertEventSignature } from '../utils/assert';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import type { EventSignature, EventSignatureToEventMap } from '../common/types';
import eventProcessingQueue from './queue';

export default async function saveEventProcessingJob<T extends EventSignature>(
  eventLog: TypedEventLog<EventSignatureToEventMap[T]>,
  expectedEventSignature: T,
) {
  const { blockNumber, transactionHash, index, args, eventSignature } =
    eventLog;

  assertEventSignature<T>(eventSignature, expectedEventSignature);

  return eventProcessingQueue
    .createJob({
      eventSignature,
      transactionHash,
      blockNumber,
      logIndex: index,
      blockTimestamp: (await eventLog.getBlock()).date ?? shouldNeverHappen(),
      args: JSON.stringify(args, (_, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }),
    })
    .setId(randomUUID())
    .retries(3)
    .backoff('exponential', 1000)
    .save();
}
