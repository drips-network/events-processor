import fs from 'fs';
import path from 'path';
import { JsonRpcProvider, WebSocketProvider } from 'ethers';
import type { ChainConfig, SupportedNetwork } from '../common/types';
import { SUPPORTED_NETWORKS } from '../common/constants';
import logger from '../common/logger';
import appSettings from '../common/appSettings';

async function getWebSocketProvider(
  network: SupportedNetwork,
): Promise<WebSocketProvider> {
  const url = `wss://${network}.infura.io/ws/v3/${appSettings.infuraApiKey}`;

  return new WebSocketProvider(url);
}

export function getNetwork(): SupportedNetwork {
  const network = appSettings.network as SupportedNetwork;

  if (!network) {
    throw new Error(`NETWORK environment variable is not set.`);
  }

  if (!SUPPORTED_NETWORKS.includes(network)) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return network;
}

async function getRPCProvider(): Promise<JsonRpcProvider> {
  const url = appSettings.rpcUrl;

  // Fast polling interval to speed up E2E tests. In production, we use a websocket provider anyway.
  return new JsonRpcProvider(url, undefined, { pollingInterval: 1000 });
}

export async function getNetworkSettings(): Promise<{
  provider: WebSocketProvider | JsonRpcProvider;
  network: SupportedNetwork;
  chainConfig: ChainConfig;
}> {
  const network = getNetwork();

  try {
    const fileNameWithExtension = `${network}.json`;
    const rootDir = path.resolve(__dirname, '..');
    const filePath = path.join(rootDir, 'config', fileNameWithExtension);

    const fileContent = fs.readFileSync(filePath, 'utf-8');

    const jsonObject: ChainConfig = JSON.parse(fileContent);

    const provider =
      appSettings.providerType === 'RPC'
        ? await getRPCProvider()
        : await getWebSocketProvider(network);

    const settings = {
      provider,
      network,
      chainConfig: jsonObject,
    };

    return settings;
  } catch (error) {
    logger.error(`Error reading ${network} config file: ${error}`);
    throw error;
  }
}
