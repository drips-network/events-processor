import { getEventHandler } from '../events/eventHandlerUtils';
import type { KnownAny } from '../core/types';
import eventProcessingQueue from './queue';
import { assertRequestId } from '../utils/assert';
import EventHandlerRequest from '../events/EventHandlerRequest';
import logger from '../core/logger';

export default async function initJobProcessingQueue() {
  eventProcessingQueue.process(5, async (job) => {
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

    try {
      await handler.afterHandle(...handleContext.event.args);
    } catch (error: any) {
      logger.error(`❌ ${handler.name} 'afterHandle' error: ${error.message}.`);
    }
  });
}
