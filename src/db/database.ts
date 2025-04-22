import { Sequelize } from 'sequelize';
import logger from '../core/logger';
import appSettings from '../config/appSettings';
import { getRegisteredModels, registerModels } from './modelRegistration';

export const dbConnection = new Sequelize(
  appSettings.postgresConnectionString,
  {
    dialect: 'postgres',
    logging: false,
    timezone: 'UTC',
  },
);

export async function connectToDb(): Promise<void> {
  try {
    await dbConnection.authenticate();

    registerModels();
    await initializeEntities();

    logger.info('Connected to the database.');
  } catch (error) {
    logger.error('Failed to connect to the database.', error);

    throw error;
  }
}

async function initializeEntities(): Promise<void> {
  logger.info('Initializing database schema...');

  getRegisteredModels().map((Model) => Model.initialize(dbConnection));

  logger.info('Database schema initialized.');
}
