import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import logger, { shouldEnableSequelizeLogging } from './common/logger';
import { SUPPORTED_NETWORKS } from './common/constants';
import sequelizeInstance from './utils/getSequelizeInstance';
import { MODELS } from './common/app-settings';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const dbName = process.env.POSTGRES_DB!;
const dbHost = process.env.POSTGRES_HOST!;
const dbPort = process.env.POSTGRES_PORT!;
const dbUsername = process.env.POSTGRES_USER!;
const dbPassword = process.env.POSTGRES_PASSWORD!;

export default async function connectToDb(): Promise<void> {
  logger.info('Initializing database...');

  await authenticate();
  initializeEntities();
  await sequelizeInstance.sync();

  logger.info('Database initialized.');
}

async function authenticate(): Promise<void> {
  try {
    await sequelizeInstance.authenticate();

    logger.info('Connection has been established successfully.');
  } catch (error: any) {
    if (error.name === 'SequelizeConnectionError') {
      logger.info('Database does not exist. Attempting to create...');

      try {
        const tempSequelize = new Sequelize(
          `postgres://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/postgres`,
          {
            logging: shouldEnableSequelizeLogging,
          },
        );
        await tempSequelize.query(`DROP DATABASE IF EXISTS ${dbName};`);
        await tempSequelize.query(`CREATE DATABASE ${dbName};`);
        SUPPORTED_NETWORKS.forEach(async (network) => {
          await sequelizeInstance.query(
            `CREATE SCHEMA IF NOT EXISTS ${network};`,
          );
        });
        await tempSequelize.close();

        logger.info('Database created successfully.');

        await sequelizeInstance.authenticate();
      } catch (e: any) {
        logger.error('Unable to create the database:', e);
      }
    } else {
      logger.error('Unable to connect to the database:', error);
    }
  }
}

function initializeEntities(): void {
  try {
    logger.info('Initializing database schema...');

    MODELS.forEach(async (Model) => {
      Model.initialize();
    });

    logger.info('Database schema initialized.');
  } catch (error: any) {
    logger.error(`Unable to initialize the database schema: ${error}.`);
    throw error;
  }
}
