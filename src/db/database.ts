import { Sequelize } from 'sequelize';
import logger from '../core/logger';
import { getRegisteredModels, registerModels } from './modelRegistration';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  GitProjectModel,
  RepoDriverSplitReceiverModel,
} from '../models';
import appSettings from '../config/appSettings';
import unreachableError from '../utils/unreachableError';

const { postgresConnectionString } = appSettings;

export const dbConnection = new Sequelize(`${postgresConnectionString}`, {
  dialect: 'postgres',
  logging: false,
  timezone: 'UTC',
});

export async function connectToDb(): Promise<void> {
  logger.info('Initializing database...');

  await authenticate();
  registerModels();
  await initializeEntities();
  defineAssociations();

  await dbConnection.sync();

  logger.info('Database initialized.');
}

async function authenticate(): Promise<void> {
  try {
    await dbConnection.authenticate();

    logger.info('Connection has been established successfully.');

    const schema = `"${(
      appSettings.network ||
      unreachableError('Missing network in app settings.')
    ).replace(/"/g, '""')}"`;

    await dbConnection.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`);

    await dbConnection.authenticate();
  } catch (error: any) {
    logger.error(
      `Unable to connect to the database: ${error} in ${error.stack}`,
    );
    throw error;
  }
}

async function initializeEntities(): Promise<void> {
  try {
    logger.info('Initializing database schema...');

    const promises = getRegisteredModels().map(async (Model) => {
      Model.initialize(dbConnection);
    });

    await Promise.all(promises);

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
