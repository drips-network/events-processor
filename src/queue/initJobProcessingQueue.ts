import { getEventHandler } from '../events/eventHandlerUtils';
import type { KnownAny } from '../core/types';
import eventProcessingQueue from './queue';
import { assertRequestId } from '../utils/assert';
import EventHandlerRequest from '../events/EventHandlerRequest';
import logger from '../core/logger';

export default async function initJobProcessingQueue() {
  eventProcessingQueue.process(100, async (job) => {
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

    const { accountIdsToInvalidate } = await handler.beforeHandle(
      handleContext as KnownAny,
    );

    await handler.executeHandle(handleContext as KnownAny);

    try {
      await handler.afterHandle({
        args: handleContext.event.args.concat(accountIdsToInvalidate),
        blockTimestamp: handleContext.event.blockTimestamp,
        requestId: handleContext.id,
      });
    } catch (error: any) {
      logger.error(
        `❌ [${handleContext.id}] ${handler.name} 'afterHandle' error: ${error.message}.`,
      );
    }
  });
}
