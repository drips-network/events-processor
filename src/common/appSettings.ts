import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.ENV}` });

const appSettings = {
  rpcUrl: process.env.RPC_URL,
  logLevel: process.env.LOG_LEVEL,
  queueUiPort: process.env.QUEUE_UI_PORT ?? 3000,
  providerType: process.env.PROVIDER_TYPE,
  infuraApiKey: process.env.INFURA_API_KEY,
  pinataSdkKey: process.env.PINATA_SDK_KEY,
  ipfsGatewayUrl: process.env.IPFS_GATEWAY_URL,
  pinataSdkSecret: process.env.PINATA_SDK_SECRET,
  network: process.env.NETWORK,
  redisConnectionString: process.env.REDIS_CONNECTION_STRING,
  postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING,
  environment: process.env.ENV ?? 'local',
  shouldProcessPastEvents:
    (process.env.SHOULD_PROCESS_PAST_EVENTS as unknown as string) === 'true',
} as const;

export default appSettings;
