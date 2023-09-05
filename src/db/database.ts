import { Sequelize } from 'sequelize';
import logger from '../common/logger';
import { SUPPORTED_NETWORKS } from '../common/constants';
import sequelizeInstance from './getSequelizeInstance';
import GitProjectModel from '../models/GitProjectModel';
import AddressDriverSplitReceiverModel from '../models/AddressDriverSplitReceiverModel';
import RepoDriverSplitReceiverModel from '../models/RepoDriverSplitReceiverModel';
import config from './config';
import { getRegisteredModels } from '../utils/registerModel';

const {
  postgresHost,
  postgresPort,
  postgresDatabase,
  postgresPassword,
  postgresUsername,
} = config;

export default async function connectToDb(): Promise<void> {
  logger.info('Initializing database...');

  await authenticate();
  initializeEntities();
  defineAssociations();
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
          `postgres://${postgresUsername}:${postgresPassword}@${postgresHost}:${postgresPort}/postgres`,
          {
            logging: (msg) => logger.debug(msg),
          },
        );
        await tempSequelize.query(
          `DROP DATABASE IF EXISTS ${postgresDatabase};`,
        );
        await tempSequelize.query(`CREATE DATABASE ${postgresDatabase};`);

        await tempSequelize.close();

        logger.info('Database created successfully.');

        for (const network of SUPPORTED_NETWORKS) {
          await sequelizeInstance.query(
            `CREATE SCHEMA IF NOT EXISTS ${network};`,
          );
        }
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

    getRegisteredModels().forEach(async (Model) => {
      Model.initialize();
    });

    logger.info('Database schema initialized.');
  } catch (error: any) {
    logger.error(`Unable to initialize the database schema: ${error}.`);
    throw error;
  }
}

function defineAssociations() {
  GitProjectModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  AddressDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderProjectId',
  });

  GitProjectModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  RepoDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderProjectId',
  });
  GitProjectModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'selfProjectId',
  });
  RepoDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'selfProjectId',
  });
}
