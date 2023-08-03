import type { SupportedNetwork } from './types';

declare namespace NodeJS {
  interface ProcessEnv {
    NETWORK: SupportedNetwork;
    INFURA_API_KEY: string;
    POSTGRES_USER: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_DB: string;
    POSTGRES_HOST: string;
    POSTGRES_PORT: number;
  }
}
