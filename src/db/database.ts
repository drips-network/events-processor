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

    defineProjectAssociations();
    defineDripListAssociations();
    defineEcosystemsAssociations();
    defineSubListAssociations();

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

function defineProjectAssociations() {
  // One-to-Many: A project can fund multiple addresses.
  GitProjectModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  AddressDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-Many: A project can fund multiple projects.
  GitProjectModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  RepoDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-Many: A project can fund multiple Drip Lists.
  GitProjectModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  DripListSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-Many: A project can fund multiple Sub Lists.
  GitProjectModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'funderSubListId',
  });
  SubListSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'funderSubListId',
  });

  // One-to-One: A project receiver represents/is a project.
  GitProjectModel.hasOne(RepoDriverSplitReceiverModel, {
    foreignKey: 'fundeeProjectId',
  });
  RepoDriverSplitReceiverModel.belongsTo(GitProjectModel, {
    foreignKey: 'fundeeProjectId',
  });
}

function defineDripListAssociations() {
  // One-to-Many: A Drip List can fund multiple addresses.
  DripListModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderDripListId',
  });
  AddressDriverSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'funderDripListId',
  });

  // One-to-Many: A Drip List can fund multiple projects.
  DripListModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderDripListId',
  });
  RepoDriverSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'funderDripListId',
  });

  // One-to-Many: A Drip List can fund multiple Drip Lists.
  DripListModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'funderDripListId',
  });
  DripListSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'funderDripListId',
  });

  // One-to-Many: A Drip List can fund multiple Sub Lists.
  DripListModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'funderDripListId',
  });
  SubListSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'funderDripListId',
  });

  // One-to-One: A Drip List receiver represents/is a Drip List.
  DripListModel.hasOne(DripListSplitReceiverModel, {
    foreignKey: 'fundeeDripListId',
  });
  DripListSplitReceiverModel.belongsTo(DripListModel, {
    foreignKey: 'fundeeDripListId',
  });
}

function defineEcosystemsAssociations() {
  // One-to-Many: An Ecosystem can fund multiple addresses.
  EcosystemModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderEcosystemId',
  });
  AddressDriverSplitReceiverModel.belongsTo(EcosystemModel, {
    foreignKey: 'funderEcosystemId',
  });

  // One-to-Many: An Ecosystem can fund multiple projects.
  EcosystemModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderEcosystemId',
  });
  RepoDriverSplitReceiverModel.belongsTo(EcosystemModel, {
    foreignKey: 'funderEcosystemId',
  });

  // One-to-Many: An Ecosystem can fund multiple Drip Lists.
  EcosystemModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'funderEcosystemId',
  });
  DripListSplitReceiverModel.belongsTo(EcosystemModel, {
    foreignKey: 'funderEcosystemId',
  });

  // One-to-Many: An Ecosystem can fund multiple Sub Lists.
  EcosystemModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'funderEcosystemId',
  });
  SubListSplitReceiverModel.belongsTo(EcosystemModel, {
    foreignKey: 'funderEcosystemId',
  });
}

function defineSubListAssociations() {
  // One-to-Many: A parent Sub List can fund multiple addresses.
  SubListModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'parentSubListId',
  });
  AddressDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentSubListId',
  });

  // One-to-Many: A parent Sub List can fund multiple projects.
  SubListModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'parentSubListId',
  });
  RepoDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentSubListId',
  });

  // One-to-Many: A parent Sub List can fund multiple Drip Lists.
  SubListModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'parentSubListId',
  });
  DripListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentSubListId',
  });

  // One-to-Many: A parent Sub List can fund multiple Sub Lists.
  SubListModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'parentSubListId',
  });
  SubListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentSubListId',
  });

  // One-to-Many: A parent Drip List can fund multiple addresses.
  SubListModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'parentDripListId',
  });
  AddressDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentDripListId',
  });

  // One-to-Many: A parent Drip List can fund multiple projects.
  SubListModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'parentDripListId',
  });
  RepoDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentDripListId',
  });

  // One-to-Many: A parent Drip List can fund multiple Drip Lists.
  SubListModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'parentDripListId',
  });
  DripListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentDripListId',
  });

  // One-to-Many: A root Drip List can fund multiple addresses.
  SubListModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'rootDripListId',
  });
  AddressDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'rootDripListId',
  });

  // One-to-Many: A root Drip List can fund multiple projects.
  SubListModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'rootDripListId',
  });
  RepoDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'rootDripListId',
  });

  // One-to-Many: A root Drip List can fund multiple Drip Lists.
  SubListModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'rootDripListId',
  });
  DripListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'rootDripListId',
  });

  // One-to-Many: A parent Ecosystem can fund multiple addresses.
  SubListModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'parentEcosystemId',
  });
  AddressDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentEcosystemId',
  });

  // One-to-Many: A parent Ecosystem can fund multiple projects.
  SubListModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'parentEcosystemId',
  });
  RepoDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentEcosystemId',
  });

  // One-to-Many: A parent Ecosystem can fund multiple Drip Lists.
  SubListModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'parentEcosystemId',
  });
  DripListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentEcosystemId',
  });
  // One-to-Many: A parent Ecosystem can fund multiple Sub Lists.
  SubListModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'parentEcosystemId',
  });
  SubListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentEcosystemId',
  });

  // One-to-Many: A root Ecosystem can fund multiple addresses.
  SubListModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'rootEcosystemId',
  });
  AddressDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'rootEcosystemId',
  });

  // One-to-Many: A root Ecosystem can fund multiple projects.
  SubListModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'rootEcosystemId',
  });
  RepoDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'rootEcosystemId',
  });

  // One-to-Many: A root Ecosystem can fund multiple Drip Lists.
  SubListModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'rootEcosystemId',
  });
  DripListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'rootEcosystemId',
  });
  // One-to-Many: A root Ecosystem can fund multiple Sub Lists.
  SubListModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'rootEcosystemId',
  });
  SubListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'rootEcosystemId',
  });

  // One-to-Many: A parent Drip List can fund multiple Sub Lists.
  SubListModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'parentSubListId',
  });
  SubListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'parentSubListId',
  });
}
