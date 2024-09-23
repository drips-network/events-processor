import logger from './core/logger';

import appSettings from './config/appSettings';
import initJobProcessingQueue from './queue/initJobProcessingQueue';
import startQueueMonitoringUI from './queue/startQueueMonitoringUI';
import { connectToDb } from './db/database';
import { registerEventHandlers } from './events/registrations';
import poll from './events/poll';
import { getHandlers } from './events/eventHandlerUtils';
import getProvider from './core/getProvider';
import { toAddress } from './utils/ethereumAddressUtils';
import loadChainConfig from './config/loadChainConfig';
import './events/types';
import networkConstant from '../contracts/CURRENT_NETWORK/network-constant';
import {
  getAddressDriverContract,
  getDripsContract,
  getNftDriverContract,
  getRepoDriverContract,
} from '../contracts/contract-types';

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);

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
  logger.info(`App Settings: ${JSON.stringify(appSettings, null, 2)}`);

  await connectToDb();
  await initJobProcessingQueue();

  registerEventHandlers();

  const { block: startBlock, contracts } = loadChainConfig();

  const { drips, addressDriver, nftDriver, repoDriver } = contracts;

  await poll(
    [
      {
        contract: getDripsContract(drips.address, await getProvider()),
        address: toAddress(contracts.drips.address),
      },
      {
        contract: getAddressDriverContract(
          addressDriver.address,
          await getProvider(),
        ),
        address: toAddress(contracts.addressDriver.address),
      },
      {
        contract: getNftDriverContract(nftDriver.address, await getProvider()),
        address: toAddress(contracts.nftDriver.address),
      },
      {
        contract: getRepoDriverContract(
          repoDriver.address,
          await getProvider(),
        ),
        address: toAddress(contracts.repoDriver.address),
      },
    ],
    getHandlers(),
    await getProvider(),
    startBlock,
  );

  if (appSettings.shouldStartMonitoringUI) {
    startQueueMonitoringUI();
  }
}
