import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.ENV}` });

const appSettings = {
  rpcUrl: process.env.RPC_URL,
  logLevel: process.env.LOG_LEVEL,
  queueUiPort: process.env.MONITORING_UI_PORT ?? 3000,
  pinataSdkKey: process.env.PINATA_SDK_KEY,
  ipfsGatewayUrl: process.env.IPFS_GATEWAY_URL,
  pinataSdkSecret: process.env.PINATA_SDK_SECRET,
  network: process.env.NETWORK,
  redisConnectionString: process.env.REDIS_CONNECTION_STRING,
  postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING,
  environment: process.env.ENV ?? 'local',
  shouldProcessPastEvents:
    (process.env.SHOULD_PROCESS_PAST_EVENTS as unknown as string) === 'true',
  shouldStartMonitoringUI:
    (process.env.SHOULD_START_MONITORING_UI as unknown as string) === 'true',
  pollingInterval: Number(process.env.POLLING_INTERVAL) ?? 5000,
} as const;

export default appSettings;
