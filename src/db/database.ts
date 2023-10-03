import { Sequelize } from 'sequelize';
import sequelizeInstance from './getSequelizeInstance';
import logger from '../common/logger';
import { SUPPORTED_NETWORKS } from '../common/constants';
import GitProjectModel from '../models/GitProjectModel';
import AddressDriverSplitReceiverModel from '../models/AddressDriverSplitReceiverModel';
import RepoDriverSplitReceiverModel from '../models/RepoDriverSplitReceiverModel';
import config from './config';
import { getRegisteredModels } from '../utils/registerModel';
import DripListModel from '../models/DripListModel';
import DripListSplitReceiverModel from '../models/DripListSplitReceiverModel';

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
      Model.initialize(sequelizeInstance);
    });

    logger.info('Database schema initialized.');
  } catch (error: any) {
    logger.error(`Unable to initialize the database schema: ${error}.`);
    throw error;
  }
}

function defineAssociations() {
  // One-to-Many: A project can fund multiple address splits.
  GitProjectModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  AddressDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-Many: A project can fund multiple project splits.
  GitProjectModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  RepoDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-Many: A project can fund multiple drip list splits.
  GitProjectModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  DripListSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-One: A RepoDriverSplitReceiver represents/is a project.
  GitProjectModel.hasOne(RepoDriverSplitReceiverModel, {
    foreignKey: 'fundeeProjectId',
  });
  RepoDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'fundeeProjectId',
  });

  // One-to-Many: A drip list can fund multiple address splits.
  DripListModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderDripListId',
  });
  AddressDriverSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'funderDripListId',
  });

  // One-to-Many: A drip list can fund multiple project splits.
  DripListModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderDripListId',
  });
  RepoDriverSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'funderDripListId',
  });

  // One-to-Many: A drip list can fund multiple drip list splits.
  DripListModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'funderDripListId',
  });
  DripListSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'funderDripListId',
  });

  // One-to-One: A DripListSplitReceiverModel represents/is a drip list.
  DripListModel.hasOne(DripListSplitReceiverModel, {
    foreignKey: 'fundeeDripListId',
  });
  DripListSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'fundeeDripListId',
  });
}
