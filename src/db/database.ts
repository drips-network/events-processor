import { Sequelize } from 'sequelize';
import logger from '../core/logger';
import { getRegisteredModels, registerModels } from './modelRegistration';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  ProjectModel,
  EcosystemMainAccountModel,
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
    defineEcosystemMainAccountsAssociations();
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
  ProjectModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  AddressDriverSplitReceiverModel.belongsTo(ProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-Many: A project can fund multiple projects.
  ProjectModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  RepoDriverSplitReceiverModel.belongsTo(ProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-Many: A project can fund multiple Drip Lists.
  ProjectModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  DripListSplitReceiverModel.belongsTo(ProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-Many: A project can fund multiple Sub Lists.
  ProjectModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'funderProjectId',
  });
  SubListSplitReceiverModel.belongsTo(ProjectModel, {
    foreignKey: 'funderProjectId',
  });

  // One-to-One: A project receiver represents/is a project.
  ProjectModel.hasOne(RepoDriverSplitReceiverModel, {
    foreignKey: 'fundeeProjectId',
  });
  RepoDriverSplitReceiverModel.belongsTo(ProjectModel, {
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

function defineEcosystemMainAccountsAssociations() {
  // One-to-Many: An Ecosystem Main Account can fund multiple addresses.
  EcosystemMainAccountModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderEcosystemMainAccountId',
  });
  AddressDriverSplitReceiverModel.belongsTo(EcosystemMainAccountModel, {
    foreignKey: 'funderEcosystemMainAccountId',
  });

  // One-to-Many: An Ecosystem Main Account can fund multiple projects.
  EcosystemMainAccountModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderEcosystemMainAccountId',
  });
  RepoDriverSplitReceiverModel.belongsTo(EcosystemMainAccountModel, {
    foreignKey: 'funderEcosystemMainAccountId',
  });

  // One-to-Many: An Ecosystem Main Account can fund multiple Drip Lists.
  EcosystemMainAccountModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'funderEcosystemMainAccountId',
  });
  DripListSplitReceiverModel.belongsTo(EcosystemMainAccountModel, {
    foreignKey: 'funderEcosystemMainAccountId',
  });

  // One-to-Many: An Ecosystem Main Account can fund multiple Sub Lists.
  EcosystemMainAccountModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'funderEcosystemMainAccountId',
  });
  SubListSplitReceiverModel.belongsTo(EcosystemMainAccountModel, {
    foreignKey: 'funderEcosystemMainAccountId',
  });
}

function defineSubListAssociations() {
  // One-to-Many: A Sub List can fund multiple addresses.
  SubListModel.hasMany(AddressDriverSplitReceiverModel, {
    foreignKey: 'funderSubListId',
  });
  AddressDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'funderSubListId',
  });

  // One-to-Many: A Sub List can fund multiple projects.
  SubListModel.hasMany(RepoDriverSplitReceiverModel, {
    foreignKey: 'funderSubListId',
  });
  RepoDriverSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'funderSubListId',
  });

  // One-to-Many: A Sub List can fund multiple Drip Lists.
  SubListModel.hasMany(DripListSplitReceiverModel, {
    foreignKey: 'funderSubListId',
  });
  DripListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'funderSubListId',
  });

  // One-to-Many: A Sub List can fund multiple Sub Lists.
  SubListModel.hasMany(SubListSplitReceiverModel, {
    foreignKey: 'funderSubListId',
  });
  SubListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'funderSubListId',
  });

  // One-to-One: A Sub List receiver represents/is a Sub List.
  SubListModel.hasOne(SubListSplitReceiverModel, {
    foreignKey: 'fundeeSubListId',
  });
  SubListSplitReceiverModel.belongsTo(SubListModel, {
    foreignKey: 'fundeeSubListId',
  });
}
