import type { SupportedNetwork } from './types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      RPC_URL: string;
      LOG_LEVEL: string;
      QUEUE_UI_PORT: string;
      PROVIDER_TYPE: string;
      INFURA_API_KEY: string;
      PINATA_SDK_KEY: string;
      IPFS_GATEWAY_URL: string;
      PINATA_SDK_SECRET: string;
      NETWORK: SupportedNetwork;
      PROCESS_PAST_EVENTS: boolean;
      REDIS_CONNECTION_STRING: string;
      POSTGRES_CONNECTION_STRING: string;
    }
  }
}

export {};
