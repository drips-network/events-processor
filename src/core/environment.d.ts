import type { SupportedNetwork } from './types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NETWORK: SupportedNetwork;
      PRIMARY_RPC_URL: string;
      PRIMARY_RPC_ACCESS_TOKEN: string | undefined;
      FALLBACK_RPC_URL: string | undefined;
      FALLBACK_RPC_ACCESS_TOKEN: string | undefined;
      MAX_PRIMARY_PROVIDER_RETRY_DURATION: number | undefined;
      NODE_ENV: 'development' | 'production';
      LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
      POLLING_INTERVAL: number;
      IPFS_GATEWAY_URL: string;
      MONITORING_UI_PORT: number;
      REDIS_CONNECTION_STRING: string;
      POSTGRES_CONNECTION_STRING: string;
      SHOULD_START_MONITORING_UI: boolean;
      SHOULD_PROCESS_PAST_EVENTS: boolean;
    }
  }
}

export {};
