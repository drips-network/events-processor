import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

export default {
  network: process.env.NETWORK,
  infuraApiKey: process.env.INFURA_API_KEY,
  postgresHost: process.env.POSTGRES_HOST,
  postgresPort: process.env.POSTGRES_PORT,
  postgresDatabase: process.env.POSTGRES_DB,
  postgresUsername: process.env.POSTGRES_USER,
  postgresPassword: process.env.POSTGRES_PASSWORD,
  redisConnectionString: process.env.REDIS_CONNECTION_STRING,
  shouldProcessPastEvents:
    (process.env.PROCESS_PAST_EVENTS as unknown as string) === 'true',
};
