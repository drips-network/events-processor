import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.ENV}` });

export default {
  logLevel: process.env.LOG_LEVEL,
  network: process.env.NETWORK,
  infuraApiKey: process.env.INFURA_API_KEY,
  redisConnectionString: process.env.REDIS_CONNECTION_STRING,
  postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING,
  shouldProcessPastEvents:
    (process.env.PROCESS_PAST_EVENTS as unknown as string) === 'true',
};
