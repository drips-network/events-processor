import sequelizeInstance from './getSequelizeInstance';
import logger from '../common/logger';
import GitProjectModel from '../models/GitProjectModel';
import AddressDriverSplitReceiverModel from '../models/AddressDriverSplitReceiverModel';
import RepoDriverSplitReceiverModel from '../models/RepoDriverSplitReceiverModel';
import { getRegisteredModels } from '../utils/registerModel';
import DripListModel from '../models/DripListModel';
import DripListSplitReceiverModel from '../models/DripListSplitReceiverModel';
import { getNetwork } from '../utils/getNetworkSettings';

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

    await sequelizeInstance.query(
      `CREATE SCHEMA IF NOT EXISTS ${getNetwork()};`,
    );

    await sequelizeInstance.authenticate();
  } catch (error: any) {
    logger.error(`Unable to connect to the database: ${error}.`);
    throw error;
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
