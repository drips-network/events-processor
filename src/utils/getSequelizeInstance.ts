import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import { shouldEnableSequelizeLogging } from '../common/logger';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const dbName = process.env.POSTGRES_DB!;
const dbHost = process.env.POSTGRES_HOST!;
const dbPort = process.env.POSTGRES_PORT!;
const dbUsername = process.env.POSTGRES_USER!;
const dbPassword = process.env.POSTGRES_PASSWORD!;

const sequelizeInstance = new Sequelize(
  `postgres://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`,
  {
    logging: shouldEnableSequelizeLogging,
  },
);

export default sequelizeInstance;
