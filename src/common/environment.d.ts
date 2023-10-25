import type { SupportedNetwork } from './types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LOG_LEVEL: string;
      INFURA_API_KEY: string;
      PINATA_SDK_KEY: string;
      PINATA_SDK_SECRET: string;
      NETWORK: SupportedNetwork;
      PROCESS_PAST_EVENTS: boolean;
      REDIS_CONNECTION_STRING: string;
      POSTGRES_CONNECTION_STRING: string;
    }
  }
}

export {};
