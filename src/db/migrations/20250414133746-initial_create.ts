import { DataTypes, literal } from 'sequelize';
import type { DataType, QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';
import type { DbSchema } from '../../core/types';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.sequelize.query(`
    CREATE TYPE ${schema}.account_type AS ENUM (
      'project',
      'drip_list',
      'ecosystem_main_account',
      'sub_list',
      'deadline',
      'address'
    );
  `);

  await queryInterface.sequelize.query(`
    CREATE TYPE ${schema}.relationship_type AS ENUM (
      'project_dependency',
      'project_maintainer',
      'drip_list_receiver',
      'ecosystem_receiver',
      'sub_list_link',
    );
  `);

  await queryInterface.sequelize.query(`
    CREATE TYPE ${schema}.project_verification_status AS ENUM (
      'claimed',
      'owner_update_requested',
      'owner_updated',
      'unclaimed',
      'pending_owner',
      'pending_metadata',
    );
  `);

  await queryInterface.sequelize.query(`
    CREATE TYPE ${schema}.forges AS ENUM (
      'gitHub',
      'gitLab',
    );
  `);

  await createSplitReceiversTable(queryInterface, schema);
  await createAccountMetadataEventsTable(queryInterface, schema);
  await createProjectsTable(queryInterface, schema);
  await createDripListsTable(queryInterface, schema);
  await createEcosystemMainAccountsTable(queryInterface, schema);
  await createTransferEventsTable(queryInterface, schema);
  await createSubListsEventsTable(queryInterface, schema);
  await createLastIndexedBlockTable(queryInterface, schema);
}

async function createLastIndexedBlockTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(`${schema}._last_indexed_block`, {
    id: {
      primaryKey: true,
      autoIncrement: true,
      type: DataTypes.INTEGER,
    },
    blockNumber: {
      unique: true,
      allowNull: false,
      type: DataTypes.BIGINT,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  });
}

async function createSubListsEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(`${schema}.sub_lists`, {
    accountId: {
      primaryKey: true,
      type: DataTypes.STRING,
    },
    parentAccountType: {
      allowNull: false,
      type: literal(`"${schema}".account_type`) as unknown as DataType,
    },
    parentId: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    rootAccountType: {
      allowNull: false,
      type: literal(`"${schema}".account_type`) as unknown as DataType,
    },
    rootId: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    lastProcessedIpfsHash: {
      allowNull: false,
      type: DataTypes.TEXT,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  });

  await queryInterface.addIndex(`${schema}.sub_lists`, ['accountId'], {
    name: 'idx_sub_lists_account_id',
  });
  await queryInterface.addIndex(`${schema}.sub_lists`, ['parentId'], {
    name: 'idx_sub_lists_parent_id',
  });
  await queryInterface.addIndex(`${schema}.sub_lists`, ['rootId'], {
    name: 'idx_sub_lists_root_id',
  });
}

async function createDripListsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(`${schema}.drip_lists`, {
    accountId: {
      primaryKey: true,
      type: DataTypes.STRING,
    },
    isValid: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    ownerAddress: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    ownerAccountId: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    name: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    latestVotingRoundId: {
      allowNull: true,
      type: DataTypes.UUID,
    },
    description: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    creator: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    previousOwnerAddress: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    isVisible: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    lastProcessedIpfsHash: {
      allowNull: false,
      type: DataTypes.TEXT,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  });

  await queryInterface.addIndex(`${schema}.drip_lists`, ['ownerAddress'], {
    name: 'idx_drip_lists_owner_address',
  });
}

async function createEcosystemMainAccountsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(`${schema}.ecosystem_main_accounts`, {
    accountId: {
      primaryKey: true,
      type: DataTypes.STRING,
    },
    isValid: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    ownerAddress: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    ownerAccountId: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    name: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    latestVotingRoundId: {
      allowNull: true,
      type: DataTypes.UUID,
    },
    description: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    creator: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    previousOwnerAddress: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    isVisible: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    lastProcessedIpfsHash: {
      allowNull: false,
      type: DataTypes.TEXT,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  });

  await queryInterface.addIndex(
    `${schema}.ecosystem_main_accounts`,
    ['ownerAddress'],
    {
      name: 'idx_ecosystem_main_accounts_owner_address',
    },
  );
}

async function createProjectsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(`${schema}.projects`, {
    accountId: {
      primaryKey: true,
      type: DataTypes.STRING,
    },
    name: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    verificationStatus: {
      allowNull: false,
      type: literal(
        `"${schema}".project_verification_status`,
      ) as unknown as DataType,
    },
    forge: {
      allowNull: false,
      type: literal(`"${schema}".forges`) as unknown as DataType,
    },
    ownerAddress: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    ownerAccountId: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    url: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    emoji: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    avatarCid: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    color: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    isVisible: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    lastProcessedIpfsHash: {
      allowNull: false,
      type: DataTypes.TEXT,
    },
    claimedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  });

  await queryInterface.addIndex(`${schema}.projects`, ['ownerAddress'], {
    name: 'idx_projects_owner_address',
  });
  await queryInterface.addIndex(`${schema}.projects`, ['verificationStatus'], {
    name: 'idx_projects_verification_status',
  });
  await queryInterface.addIndex(`${schema}.projects`, ['url'], {
    name: 'idx_projects_url',
  });
}

async function createAccountMetadataEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    `${schema}.account_metadata_emitted_events`,
    {
      key: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      value: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      accountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      transactionHash: {
        primaryKey: true,
        allowNull: false,
        type: DataTypes.STRING,
      },
      logIndex: {
        primaryKey: true,
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      blockTimestamp: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      blockNumber: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
    },
  );

  await queryInterface.addIndex(
    `${schema}.account_metadata_emitted_events`,
    ['accountId'],
    {
      name: 'idx_account_metadata_emitted_events_accountId',
    },
  );
}

async function createTransferEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(`${schema}.transfer_events`, {
    tokenId: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    from: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    to: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    transactionHash: {
      primaryKey: true,
      allowNull: false,
      type: DataTypes.STRING,
    },
    logIndex: {
      primaryKey: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    blockNumber: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    blockTimestamp: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  });
}

async function createSplitReceiversTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(`${schema}.split_receivers`, {
    id: {
      primaryKey: true,
      autoIncrement: true,
      type: DataTypes.INTEGER,
    },
    receiverAccountId: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    receiverAccountType: {
      allowNull: false,
      type: literal(`"${schema}".account_type`) as unknown as DataType,
    },
    senderAccountId: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    senderAccountType: {
      allowNull: false,
      type: literal(`"${schema}".account_type`) as unknown as DataType,
    },
    relationshipType: {
      allowNull: false,
      type: literal(`"${schema}".relationship_type`) as unknown as DataType,
    },
    weight: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    blockTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex(
    `${schema}.split_receivers`,
    ['receiverAccountId', 'senderAccountId'],
    {
      name: 'idx_split_receivers_receiver_sender',
    },
  );
  await queryInterface.addIndex(
    `${schema}.split_receivers`,
    ['senderAccountId', 'receiverAccountId'],
    {
      name: 'idx_split_receivers_sender_receiver',
    },
  );
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.dropTable(`${schema}.split_receivers`);
  await queryInterface.dropTable(`${schema}.account_metadata_emitted_events`);
  await queryInterface.dropTable(`${schema}.projects`);
  await queryInterface.dropTable(`${schema}.drip_lists`);
  await queryInterface.dropTable(`${schema}.ecosystem_main_accounts`);
  await queryInterface.dropTable(`${schema}.transfer_events`);
  await queryInterface.dropTable(`${schema}.sub_lists`);
  await queryInterface.dropTable(`${schema}._last_indexed_block`);

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS ${schema}.account_type;
  `);

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS ${schema}.relationship_type;
  `);

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS ${schema}.project_verification_status;
  `);

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS ${schema}.forges;
  `);
}
