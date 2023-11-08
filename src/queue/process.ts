import { getEventHandler } from '../eventsConfiguration/eventHandlerUtils';
import type { KnownAny } from '../common/types';
import eventProcessingQueue from './queue';
import { assertRequestId } from '../utils/assert';
import EventHandlerRequest from '../eventsConfiguration/EventHandlerRequest';

export default async function startQueueProcessing() {
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

    assertRequestId(job.id);

    const handleContext = new EventHandlerRequest(
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
      job.id,
    );

    await handler.executeHandle(handleContext as KnownAny);
  });
}
