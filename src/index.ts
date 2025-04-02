import express from 'express';
import logger from './core/logger';
import appSettings from './config/appSettings';
import initJobProcessingQueue from './queue/initJobProcessingQueue';
import { arenaConfig } from './queue/queueMonitoring';
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
import networkConstant from '../contracts/CURRENT_NETWORK/network-constant';
import { healthEndpoint } from './health';

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}. Stack: ${error.stack}`);

  // Railway will restart the process if it exits with a non-zero exit code.
  process.exit(1);
});

(async () => {
  await init();
})();

async function init() {
  if (appSettings.network !== networkConstant) {
    throw new Error(
      `Built contracts types are for network ${networkConstant}, but the app is configured for ${appSettings.network} network. Please re-run 'npm run build:contracts' after changing the NETWORK env var.`,
    );
  }

  logger.info('Starting the application...');

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

  const app = express();

  if (appSettings.shouldStartMonitoringUI) {
    app.use('/arena', arenaConfig);
    app.use('/health', healthEndpoint);
  }

  app.listen(appSettings.queueUiPort, () => {
    logger.info(
      `Monitoring available on port ${appSettings.queueUiPort}. Routes: /health, /arena`,
    );
  });
}
