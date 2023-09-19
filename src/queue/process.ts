import { getEventHandler } from '../utils/registerEventHandler';
import type { KnownAny } from '../common/types';
import { HandleRequest } from '../common/types';
import eventProcessingQueue from './queue';
import { assertUUID } from '../utils/assert';

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

    assertUUID(job.id);

    const handleContext = new HandleRequest(
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
