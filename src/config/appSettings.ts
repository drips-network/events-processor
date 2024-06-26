import dotenv from 'dotenv';
import shouldNeverHappen from '../utils/shouldNeverHappen';

dotenv.config({ path: `.env.${process.env.ENV}` });

const appSettings = {
  network: process.env.NETWORK || shouldNeverHappen('NETWORK is not set.'),
  rpcUrl: process.env.RPC_URL || shouldNeverHappen('RPC_URL is not set.'),
  logLevel: process.env.LOG_LEVEL || 'debug',
  pollingInterval: Number(process.env.POLLING_INTERVAL) ?? 5000,
  ipfsGatewayUrl:
    process.env.IPFS_GATEWAY_URL || 'https://drips.mypinata.cloud',
  queueUiPort: process.env.MONITORING_UI_PORT ?? 3000,
  redisConnectionString: process.env.REDIS_CONNECTION_STRING,
  postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING,
  shouldStartMonitoringUI:
    (process.env.SHOULD_START_MONITORING_UI as unknown as string) === 'true',
  shouldProcessPastEvents:
    (process.env.SHOULD_PROCESS_PAST_EVENTS as unknown as string) === 'true',
  cacheInvalidationEndpoint: process.env.CACHE_INVALIDATION_ENDPOINT,
} as const;

export default appSettings;
