import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { JsonRpcProvider, WebSocketProvider } from 'ethers';
import type { ChainConfig, SupportedNetwork } from '../common/types';
import { SUPPORTED_NETWORKS } from '../common/constants';
import logger from '../common/logger';

dotenv.config({ path: `.env.${process.env.ENV}` });

async function getWebSocketProvider(
  network: SupportedNetwork,
): Promise<WebSocketProvider> {
  const url = `wss://${network}.infura.io/ws/v3/${process.env.INFURA_API_KEY}`;

  return new WebSocketProvider(url);
}

export function getNetwork(): SupportedNetwork {
  const network = process.env.NETWORK as SupportedNetwork;

  if (!network) {
    throw new Error(`NETWORK environment variable is not set.`);
  }

  if (!SUPPORTED_NETWORKS.includes(network)) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return network;
}

async function getRPCProvider(): Promise<JsonRpcProvider> {
  const url = process.env.RPC_URL;

  return new JsonRpcProvider(url);
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
      process.env.PROVIDER_TYPE === 'RPC'
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
