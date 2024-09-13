import dotenv from 'dotenv';

dotenv.config();

function missingEnvVar(name: string): never {
  throw new Error(`Missing ${name} in .env file.`);
}

const appSettings = {
  network: process.env.NETWORK || missingEnvVar('NETWORK is not set.'),
  primaryRpcUrl:
    process.env.PRIMARY_RPC_URL || missingEnvVar('PRIMARY_RPC_URL is not set.'),
  fallbackRpcUrl: process.env.FALLBACK_RPC_URL,
  primaryRpcAccessToken: process.env.PRIMARY_RPC_ACCESS_TOKEN,
  fallbackRpcAccessToken: process.env.FALLBACK_RPC_ACCESS_TOKEN,
  maxPrimaryProviderRetryDuration:
    Number(process.env.MAX_PRIMARY_PROVIDER_RETRY_DURATION) || 86400000, // 24 hours.
  logLevel: process.env.LOG_LEVEL || 'debug',
  pollingInterval: Number(process.env.POLLING_INTERVAL) || 5000,
  chunkSize: Number(process.env.CHUNK_SIZE) || 1000,
  confirmations: Number(process.env.CONFIRMATIONS) || 1,
  ipfsGatewayUrl:
    process.env.IPFS_GATEWAY_URL || 'https://drips.mypinata.cloud',
  queueUiPort: process.env.MONITORING_UI_PORT || 3000,
  redisConnectionString: process.env.REDIS_CONNECTION_STRING,
  postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING,
  shouldStartMonitoringUI:
    (process.env.SHOULD_START_MONITORING_UI as unknown as string) === 'true',
  cacheInvalidationEndpoint: process.env.CACHE_INVALIDATION_ENDPOINT,
} as const;

export default appSettings;
