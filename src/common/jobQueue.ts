import BeeQueue from 'bee-queue';
import type { UUID } from 'crypto';
import { randomUUID } from 'crypto';
import { HandleContext } from './types';
import type {
  KnownAny,
  EventSignature,
  EventSignatureToEventMap,
} from './types';
import type { TypedEventLog } from '../../contracts/common';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import config from '../db/config';
import logger from './logger';
import { getEventHandler } from '../utils/registerEventHandler';
import { assertEventSignature } from '../utils/assert';

export const eventProcessingQueue = new BeeQueue<{
  logIndex: number;
  eventSignature: EventSignature;
  blockNumber: number;
  blockTimestamp: Date;
  transactionHash: string;
  args: string;
}>(`${config.network}_events`, { activateDelayedJobs: true });

eventProcessingQueue.process(async (job) => {
  const handler = getEventHandler(job.data.eventSignature);

  const {
    eventSignature,
    transactionHash,
    blockNumber,
    logIndex,
    args,
    blockTimestamp,
  } = job.data;

  const handleContext = new HandleContext(
    {
      args: JSON.parse(args, (_, value) => {
        if (typeof value === 'bigint') {
          return BigInt(value);
        }
        return value;
      }) as any,
      logIndex,
      blockNumber,
      eventSignature,
      blockTimestamp,
      transactionHash,
    },
    job.id as UUID,
  );

  await handler.executeHandle(handleContext as KnownAny);
});

eventProcessingQueue.on('succeeded', (job) => {
  logger.info(`SUCCESS: Job with ID ${job.id} completed successfully.`);
});

eventProcessingQueue.on('job failed', (job, err) => {
  logger.error(
    `FAILED: Job with ID ${job} failed with error '${err.message}'.`,
  );
});

eventProcessingQueue.on('job retrying', (job, err) => {
  logger.warn(
    `Job with ID ${job} failed with error ${err.message} but is being retried...`,
  );
});

eventProcessingQueue.on('stalled', (job) => {
  logger.error(`Job with ID ${job} stalled!`);
});

eventProcessingQueue.on('error', (error) => {
  logger.error(`Job with ID failed with error: ${error.message}`);
});

// TODO:  const s = eventLog.interface.hasEvent('OwnerUpdated(uint256,address)');

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
    .retries(5)
    .backoff('exponential', 1000)
    .save();
}
