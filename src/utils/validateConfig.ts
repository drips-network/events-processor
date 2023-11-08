import logger from '../common/logger';
import { DRIPS_CONTRACTS, SUPPORTED_NETWORKS } from '../common/constants';
import { getNetworkSettings } from './getNetworkSettings';
import { getRegisteredEvents } from '../eventsConfiguration/eventHandlerUtils';
import config from '../common/appSettings';

export default async function validateNetworkSettings(): Promise<void> {
  const { chainConfig, network, provider } = await getNetworkSettings();

  DRIPS_CONTRACTS.forEach((contract) => {
    if (!chainConfig[contract]) {
      throw new Error(
        `No ${contract} contract configuration found in network settings.`,
      );
    }
  });

  if (!SUPPORTED_NETWORKS.includes(network)) {
    throw new Error(
      `Unsupported network: ${network} found in network settings.`,
    );
  }

  if (!provider) {
    throw new Error('No provider found in network settings.');
  }

  logger.info(
    `Loaded Configuration: ${JSON.stringify(
      {
        chainConfig,
        network,
        config,
        registeredEvents: getRegisteredEvents(),
      },
      null,
      2,
    )}`,
  );
}
