// TODO: parallelize requests if this logic ever becomes inefficient.

import type { TypedEventLog } from '../../contracts/common';
import logger from '../common/logger';
import { getNetworkSettings } from './getNetworkSettings';
import { getContractDetails } from './getContract';
import type { DripsEvent, EventSignature } from '../common/types';
import { HandleRequest } from '../common/types';
import type EventHandlerBase from '../common/EventHandlerBase';
import { getEventHandler, getRegisteredEvents } from './registerEventHandler';
import getTypedEvent from './getTypedEvent';

export default async function processPastEvents(): Promise<void> {
  logger.info('Start processing past events. This might take a while...');

  const { chainConfig, provider } = await getNetworkSettings();

  let totalProcessedLogs = 0;
  let totalFailedLogs = 0;

  const endBlock = await provider.getBlockNumber();
  const registeredEvents = getRegisteredEvents();

  await Promise.all(
    registeredEvents.map(async (filterSignature) => {
      const { contract, name: contractName } =
        await getContractDetails(filterSignature);
      const event = await getTypedEvent(filterSignature);
      const handler = getEventHandler(filterSignature);

      let foundLogsOfType = 0;
      let processedLogsOfType = 0;
      let failedLogsOfType = 0;

      let i;
      const batchSize = 5000;
      const startBlock = chainConfig[contractName].block;

      for (i = startBlock; i < endBlock; i += batchSize) {
        const logs = await contract.queryFilter(
          event,
          i,
          Math.min(i + batchSize - 1, endBlock),
        );

        foundLogsOfType += logs.length;

        const { processedEvents, failedEvents } = await ingest(logs, handler);

        processedLogsOfType += processedEvents;
        failedLogsOfType += failedEvents;
      }

      if (i < endBlock) {
        const remainingLogs = await contract.queryFilter(event, i, endBlock);

        foundLogsOfType += remainingLogs.length;

        const { processedEvents, failedEvents } = await ingest(
          remainingLogs,
          handler,
        );

        processedLogsOfType += processedEvents;
        failedLogsOfType += failedEvents;
      }

      totalProcessedLogs += processedLogsOfType;
      totalFailedLogs += failedLogsOfType;

      logger[failedLogsOfType > 0 ? 'warn' : 'info'](
        `Found ${foundLogsOfType} ${event.name} ${
          foundLogsOfType > 1 ? 'events' : 'event' // 🤓
        } until block ${endBlock}, processed successfully ${processedLogsOfType} and failed ${failedLogsOfType}.`,
      );
    }),
  );

  logger.info(`Total processed logs: ${totalProcessedLogs}`);
  if (totalFailedLogs) logger.warn(`Total failed logs: ${totalFailedLogs}`);
  logger.info('Syncing of past logs completed.');
}

async function ingest(
  logs: TypedEventLog<DripsEvent>[],
  handler: EventHandlerBase<EventSignature>,
): Promise<{
  processedEvents: number;
  failedEvents: number;
}> {
  let processedEvents = 0;
  let failedEvents = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const log of logs) {
    const result = await handler.executeHandle(new HandleRequest(log));

    if (result.ok) {
      processedEvents++;
    } else {
      failedEvents++;
    }
  }

  return { processedEvents, failedEvents };
}
