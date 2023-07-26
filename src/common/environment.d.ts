declare namespace NodeJS {
  interface ProcessEnv {
    INFURA_API_KEY: string;
    POSTGRES_USER: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_DB: string;
    POSTGRES_HOST: string;
    POSTGRES_PORT: number;
  }
}
