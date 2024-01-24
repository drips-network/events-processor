import { getRegisteredEvents } from '../events/eventHandlerUtils';
import logger from './logger';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { getContractInfoFromEvent } from '../utils/contractUtils';
import { getTypedEvent } from '../utils/eventUtils';
import loadChainConfig from '../config/loadChainConfig';
import appProvider from './appProvider';

export default async function processPastEvents(): Promise<void> {
  logger.info('Start processing past events. This might take a while...');

  const endBlock = await appProvider.getBlockNumber();
  logger.info(`End block number: ${endBlock}`);

  await Promise.all(
    getRegisteredEvents().map(async (eventSignature) => {
      const { contract, name: contractName } =
        await getContractInfoFromEvent(eventSignature);
      const event = await getTypedEvent(eventSignature);

      let i;
      const batchSize = 5000;
      const chainConfig = loadChainConfig();
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
