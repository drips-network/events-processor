import { getRegisteredEvents } from '../eventsConfiguration/eventHandlerUtils';
import { getNetworkSettings } from './getNetworkSettings';
import logger from '../common/logger';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { getOriginContractByEvent } from './contractUtils';
import { getTypedEvent } from './eventUtils';

export default async function processPastEvents(): Promise<void> {
  logger.info('Start processing past events. This might take a while...');

  const { chainConfig, provider } = await getNetworkSettings();

  const endBlock = await provider.getBlockNumber();
  logger.info(`End block number: ${endBlock}`);

  await Promise.all(
    getRegisteredEvents().map(async (eventSignature) => {
      const { contract, name: contractName } =
        await getOriginContractByEvent(eventSignature);
      const event = await getTypedEvent(eventSignature);

      let i;
      const batchSize = 5000;
      const startBlock = chainConfig[contractName].block;
      logger.info(`Start block number for ${contractName}: ${startBlock}`);

      for (i = startBlock; i < endBlock; i += batchSize) {
        const eventLogs = await contract.queryFilter(
          event,
          i,
          Math.min(i + batchSize - 1, endBlock),
        );

        for (const eventLog of eventLogs) {
          await saveEventProcessingJob(eventLog, eventSignature);
        }
      }

      if (i < endBlock) {
        const remainingEventLogs = await contract.queryFilter(
          event,
          i,
          endBlock,
        );

        for (const eventLog of remainingEventLogs) {
          await saveEventProcessingJob(eventLog, eventSignature);
        }
      }
    }),
  );
}
