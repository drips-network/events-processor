import type { SupportedNetwork } from './types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      RPC_URL: string;
      LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
      QUEUE_UI_PORT: number;
      PROVIDER_TYPE: 'INFURA_WS' | 'RPC';
      INFURA_API_KEY: string;
      PINATA_SDK_KEY: string;
      IPFS_GATEWAY_URL: string;
      PINATA_SDK_SECRET: string;
      NETWORK: SupportedNetwork;
      REDIS_CONNECTION_STRING: string;
      POSTGRES_CONNECTION_STRING: string;
      ENV: 'local' | SupportedNetwork;
      SHOULD_PROCESS_PAST_EVENTS: boolean;
    }
  }
}

export {};
