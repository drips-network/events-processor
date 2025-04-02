import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { ZodError } from 'zod';
import { appSettingsSchema, type AppSettings } from './appSettings.schema';

dotenvExpand.expand(dotenv.config());

function loadAppSettings(): AppSettings {
  const appSettings = {
    network: process.env.NETWORK,
    primaryRpcUrl: process.env.PRIMARY_RPC_URL,
    fallbackRpcUrl: process.env.FALLBACK_RPC_URL,
    primaryRpcAccessToken: process.env.PRIMARY_RPC_ACCESS_TOKEN,
    fallbackRpcAccessToken: process.env.FALLBACK_RPC_ACCESS_TOKEN,
    logger: {
      level: process.env.LOG_LEVEL,
      format: process.env.LOG_FORMAT,
      destination: process.env.LOG_DESTINATION,
      filename: process.env.LOG_FILE,
    },
    pollingInterval: process.env.POLLING_INTERVAL
      ? parseInt(process.env.POLLING_INTERVAL, 10)
      : undefined,
    chunkSize: process.env.CHUNK_SIZE
      ? parseInt(process.env.CHUNK_SIZE, 10)
      : undefined,
    confirmations: process.env.CONFIRMATIONS
      ? parseInt(process.env.CONFIRMATIONS, 10)
      : undefined,
    ipfsGatewayUrl: process.env.IPFS_GATEWAY_URL,
    monitoringUiPort: process.env.MONITORING_UI_PORT,
    redisConnectionString: process.env.REDIS_CONNECTION_STRING,
    postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING,
    shouldStartMonitoringUI:
      (process.env.SHOULD_START_MONITORING_UI as unknown as string) === 'true',
    cacheInvalidationEndpoint: process.env.CACHE_INVALIDATION_ENDPOINT,
    visibilityThresholdBlockNumber: process.env
      .VISIBILITY_THRESHOLD_BLOCK_NUMBER
      ? parseInt(process.env.VISIBILITY_THRESHOLD_BLOCK_NUMBER, 10)
      : undefined,
  };

  try {
    return appSettingsSchema.parse(appSettings);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors
        .map((err) => {
          const path = err.path.join('.');
          const { message } = err;
          return `- ${path ? `'${path}': ` : ''}${message}`;
        })
        .join('\n');

      throw new Error(`Invalid configuration:\n\n${details}\n`);
    }

    throw error;
  }
}

// Singleton app settings instance
const appSettings = loadAppSettings();
export default appSettings;
