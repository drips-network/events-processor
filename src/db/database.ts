import { Sequelize } from 'sequelize';
import logger from '../core/logger';
import { getRegisteredModels, registerModels } from './modelRegistration';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  GitProjectModel,
  EcosystemModel,
  RepoDriverSplitReceiverModel,
  SubListModel,
  SubListSplitReceiverModel,
} from '../models';
import appSettings from '../config/appSettings';

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
    defineAssociations();

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

  // One-to-Many: A drip list can fund multiple sub list splits.
  DripListModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'funderDripListId',
  });
  SubListSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'funderDripListId',
  });

  // One-to-Many: An Ecosystem can have multiple SubLists.
  EcosystemModel.hasMany(SubListModel, {
    foreignKey: 'ecosystemId',
  });
  SubListModel.belongsTo(EcosystemModel, {
    foreignKey: 'ecosystemId',
  });

  // One-to-Many: An Ecosystem can fund multiple sub list splits.
  EcosystemModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'funderEcosystemId',
  });
  SubListSplitReceiverModel.belongsTo(EcosystemModel, {
    foreignKey: 'funderEcosystemId',
  });

  // One-to-Many: An Ecosystem can fund multiple project splits.
  EcosystemModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderEcosystemId',
  });
  RepoDriverSplitReceiverModel.belongsTo(EcosystemModel, {
    foreignKey: 'funderEcosystemId',
  });

  // One-to-One: A DripListSplitReceiverModel represents/is a drip list.
  DripListModel.hasOne(DripListSplitReceiverModel, {
    foreignKey: 'fundeeDripListId',
  });
  DripListSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'fundeeDripListId',
  });

  // One-to-One: A SubListSplitReceiverModel represents/is a sub list.
  SubListModel.hasOne(SubListSplitReceiverModel, {
    foreignKey: 'fundeeImmutableSplitsId',
  });
  SubListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'fundeeImmutableSplitsId',
  });
}
