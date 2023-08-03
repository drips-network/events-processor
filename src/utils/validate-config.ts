import logger from '../common/logger';
import { SUPPORTED_CONTRACTS, SUPPORTED_NETWORKS } from '../config/constants';
import { getNetworkSettings } from './get-network-settings';
import getRegisteredEvents from './get-registered-events';

export default async function validateNetworkSettings(): Promise<void> {
  const { chainConfig, network, provider } = await getNetworkSettings();

  SUPPORTED_CONTRACTS.forEach((contract) => {
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
        registeredEvents: getRegisteredEvents(),
      },
      null,
      2,
    )}`,
  );
}
