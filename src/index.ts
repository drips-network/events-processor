import logger from './core/logger';

import appSettings from './config/appSettings';
import initJobProcessingQueue from './queue/initJobProcessingQueue';
import startQueueMonitoringUI from './queue/startQueueMonitoringUI';
import { connectToDb } from './db/database';
import { registerEventHandlers } from './events/registrations';
import poll from './events/poll';
import { getHandlers } from './events/eventHandlerUtils';
import getProvider from './core/getProvider';
import {
  addressDriverContract,
  dripsContract,
  nftDriverContract,
  repoDriverContract,
} from './core/contractClients';
import { toAddress } from './utils/ethereumAddressUtils';
import loadChainConfig from './config/loadChainConfig';
import './events/types';

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);

  // Railway will restart the process if it exits with a non-zero exit code.
  process.exit(1);
});

(async () => {
  await init();
})();

async function init() {
  logger.info('Starting the application...');
  logger.info(`App Settings: ${JSON.stringify(appSettings, null, 2)}`);

  await connectToDb();
  await initJobProcessingQueue();

  registerEventHandlers();

  const { block: startBlock } = loadChainConfig();

  await poll(
    [
      {
        contract: dripsContract,
        address: toAddress(await dripsContract.getAddress()),
      },
      {
        contract: addressDriverContract,
        address: toAddress(await addressDriverContract.getAddress()),
      },
      {
        contract: nftDriverContract,
        address: toAddress(await nftDriverContract.getAddress()),
      },
      {
        contract: repoDriverContract,
        address: toAddress(await repoDriverContract.getAddress()),
      },
    ],
    getHandlers(),
    getProvider(),
    startBlock,
  );

  if (appSettings.shouldStartMonitoringUI) {
    startQueueMonitoringUI();
  }
}
