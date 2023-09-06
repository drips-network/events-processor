import { getRegisteredEvents } from './registerEventHandler';
import { getContractDetails } from './getContract';
import getTypedEvent from './getTypedEvent';
import { getNetworkSettings } from './getNetworkSettings';
import logger from '../common/logger';
import saveEventProcessingJob from '../common/jobQueue';

export default async function processPastEvents(): Promise<void> {
  logger.info('Start processing past events. This might take a while...');

  const { chainConfig, provider } = await getNetworkSettings();

  const endBlock = await provider.getBlockNumber();

  await Promise.all(
    getRegisteredEvents().map(async (eventSignature) => {
      const { contract, name: contractName } =
        await getContractDetails(eventSignature);
      const event = await getTypedEvent(eventSignature);

      let i;
      const batchSize = 5000;
      const startBlock = chainConfig[contractName].block;

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
