import type { SupportedNetwork } from './types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NETWORK: SupportedNetwork;
      RPC_URL: string;
      NODE_ENV: 'development' | 'production';
      LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
      POLLING_INTERVAL: number;
      IPFS_GATEWAY_URL: string;
      MONITORING_UI_PORT: number;
      REDIS_CONNECTION_STRING: string;
      POSTGRES_CONNECTION_STRING: string;
      SHOULD_START_MONITORING_UI: boolean;
      SHOULD_PROCESS_PAST_EVENTS: boolean;
      ENV: 'local' | SupportedNetwork;
    }
  }
}

export {};
