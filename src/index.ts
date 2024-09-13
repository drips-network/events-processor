import logger from './core/logger';

import appSettings from './config/appSettings';
import initJobProcessingQueue from './queue/initJobProcessingQueue';
import startQueueMonitoringUI from './queue/startQueueMonitoringUI';
import { connectToDb } from './db/database';
import { registerEventHandlers } from './events/registrations';
import poll from './events/poll';
import { getHandlers } from './events/eventHandlerUtils';
import { createProvider } from './core/createProvider';
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
import unreachableError from './utils/unreachableError';
import FailoverProvider from './core/FailoverProvider';

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

  await initFailoverProvider();

  await connectToDb();
  await initJobProcessingQueue();

  registerEventHandlers();

  const { block: startBlock, contracts } = loadChainConfig();

  await poll(
    [
      {
        contract: getDripsContract(
          contracts.drips.address,
          FailoverProvider.getActiveProvider(),
        ),
        address: toAddress(contracts.drips.address),
      },
      {
        contract: getAddressDriverContract(
          contracts.addressDriver.address,
          FailoverProvider.getActiveProvider(),
        ),
        address: toAddress(contracts.addressDriver.address),
      },
      {
        contract: getNftDriverContract(
          contracts.nftDriver.address,
          FailoverProvider.getActiveProvider(),
        ),
        address: toAddress(contracts.nftDriver.address),
      },
      {
        contract: getRepoDriverContract(
          contracts.repoDriver.address,
          FailoverProvider.getActiveProvider(),
        ),
        address: toAddress(contracts.repoDriver.address),
      },
    ],
    getHandlers(),
    startBlock,
  );

  if (appSettings.shouldStartMonitoringUI) {
    startQueueMonitoringUI();
  }
}
async function initFailoverProvider() {
  const {
    primaryRpcUrl,
    primaryRpcAccessToken,
    fallbackRpcUrl,
    pollingInterval,
    fallbackRpcAccessToken,
    maxPrimaryProviderRetryDuration,
  } = appSettings;

  FailoverProvider.init({
    primaryProvider: {
      provider:
        (await createProvider(
          primaryRpcUrl,
          pollingInterval,
          primaryRpcAccessToken,
        )) ?? unreachableError(),
      healthCheckTimeout: 5000,
      retryOptions: {
        maxRetries: Infinity, // Retry indefinitely.
        baseBackoffDelay: 30000, // Start with a 30 second delay.
        maxBackoffDelay: 600000, // Cap the delay at 10 minutes.
        maxRetryDuration: maxPrimaryProviderRetryDuration, // Retry for up to 24 hours.
      },
      name: primaryRpcUrl,
    },
    fallbackProviders: fallbackRpcUrl
      ? [
          {
            provider:
              (await createProvider(
                fallbackRpcUrl,
                pollingInterval,
                fallbackRpcAccessToken,
              )) ?? unreachableError(),
            healthCheckTimeout: 5000,
            name: fallbackRpcUrl,
          },
        ]
      : undefined,
    logger,
    pingInterval: 10000, // 30 * 60 * 1000, // 30 minutes
  });
}

process.on('uncaughtException', async (error: Error) => {
  // TODO: remove this after making sure `FailoverProvider` did its job on production.
  if (
    error.message
      ?.toLowerCase()
      .includes('503 Service Unavailable'.toLowerCase())
  ) {
    logger.warn('This should have been caught by the `FailoverProvider`.');

    await FailoverProvider.destroy();
    await initFailoverProvider();

    return;
  }

  logger.error(`Uncaught Exception: ${error.message} \n${error.stack}`);

  // Railway will restart the process if it exits with a non-zero exit code.
  process.exit(1);
});
