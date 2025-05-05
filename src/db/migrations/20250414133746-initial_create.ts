import { DataTypes, literal } from 'sequelize';
import type { DataType, QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';
import type { DbSchema } from '../../core/types';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.sequelize.query(
    `CREATE SCHEMA IF NOT EXISTS ${schema};`,
  );

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
      'sub_list_link'
    );
  `);

  await queryInterface.sequelize.query(`
    CREATE TYPE ${schema}.project_verification_status AS ENUM (
      'claimed',
      'unclaimed',
      'pending_metadata'
    );
  `);

  await queryInterface.sequelize.query(`
    CREATE TYPE ${schema}.forges AS ENUM (
      'github',
      'gitlab'
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
  await createGivenEventsTable(queryInterface, schema);
  await createSplitEventsTable(queryInterface, schema);
  await createSqueezedStreamsEventsTable(queryInterface, schema);
  await createStreamReceiverSeenEventsTable(queryInterface, schema);
  await createStreamsSetEventsTable(queryInterface, schema);
  await createSplitsSetEventsTable(queryInterface, schema);
  await createOwnerUpdatedEventsTable(queryInterface, schema);
}

async function createOwnerUpdatedEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `owner_updated_events`,
    },
    transformFieldNamesToSnakeCase({
      owner: {
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
      blockNumber: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      blockTimestamp: {
        allowNull: false,
        type: DataTypes.DATE,
      },
    }),
  );
}

async function createSplitsSetEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `splits_set_events`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      receiversHash: {
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
    }),
  );
}

async function createStreamsSetEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `streams_set_events`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      erc20: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      receiversHash: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      streamsHistoryHash: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      balance: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      maxEnd: {
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `streams_set_events`,
    },
    transformFieldArrayToSnakeCase(['receiversHash']),
    {
      name: 'idx_streams_set_events_receiversHash',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `streams_set_events`,
    },
    transformFieldArrayToSnakeCase(['accountId']),
    {
      name: 'idx_streams_set_events_accountId',
    },
  );
}

async function createStreamReceiverSeenEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `stream_receiver_seen_events`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      config: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      receiversHash: {
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `stream_receiver_seen_events`,
    },
    transformFieldArrayToSnakeCase(['accountId']),
    {
      name: 'idx_stream_receiver_seen_events_accountId',
    },
  );
}

async function createSqueezedStreamsEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `squeezed_streams_events`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      erc20: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      senderId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      amount: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      streamsHistoryHashes: {
        allowNull: false,
        type: DataTypes.TEXT,
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
    }),
  );
}

async function createSplitEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `split_events`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      receiver: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      erc20: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      amt: {
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `split_events`,
    },
    transformFieldArrayToSnakeCase(['receiver']),
    {
      name: 'idx_split_events_receiver',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `split_events`,
    },
    transformFieldArrayToSnakeCase(['accountId', 'receiver']),
    {
      name: 'idx_split_events_accountId_receiver',
    },
  );
}

async function createGivenEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `given_events`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      receiver: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      erc20: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      amt: {
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `given_events`,
    },
    transformFieldArrayToSnakeCase(['accountId']),
    {
      name: 'idx_given_events_accountId',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `given_events`,
    },
    transformFieldArrayToSnakeCase(['receiver']),
    {
      name: 'idx_given_events_receiver',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `given_events`,
    },
    transformFieldArrayToSnakeCase(['erc20']),
    {
      name: 'idx_given_events_erc20',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `given_events`,
    },
    transformFieldArrayToSnakeCase(['transactionHash', 'logIndex']),
    {
      name: 'idx_given_events_transactionHash_logIndex',
    },
  );
}

async function createLastIndexedBlockTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `last_indexed_block`,
    },
    transformFieldNamesToSnakeCase({
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
    }),
  );
}

async function createSubListsEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `sub_lists`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        primaryKey: true,
        type: DataTypes.STRING,
      },
      isValid: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
      },
      parentAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      parentAccountType: {
        allowNull: false,
        type: literal(`${schema}.account_type`).val as unknown as DataType,
      },
      rootAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      rootAccountType: {
        allowNull: false,
        type: literal(`${schema}.account_type`).val as unknown as DataType,
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `sub_lists`,
    },
    transformFieldArrayToSnakeCase(['accountId']),
    {
      name: 'idx_sub_lists_account_id',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `sub_lists`,
    },
    transformFieldArrayToSnakeCase(['parentAccountId']),
    {
      name: 'idx_sub_lists_parent_account_id',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `sub_lists`,
    },
    transformFieldArrayToSnakeCase(['rootAccountId']),
    {
      name: 'idx_sub_lists_root_account_id',
    },
  );
}

async function createDripListsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `drip_lists`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        primaryKey: true,
        type: DataTypes.STRING,
      },
      isValid: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
      },
      ownerAddress: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      ownerAccountId: {
        allowNull: false,
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
      lastProcessedVersion: {
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `drip_lists`,
    },
    transformFieldArrayToSnakeCase(['ownerAddress']),
    {
      name: 'idx_drip_lists_owner_address',
    },
  );
}

async function createEcosystemMainAccountsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `ecosystem_main_accounts`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        primaryKey: true,
        type: DataTypes.STRING,
      },
      isValid: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
      },
      ownerAddress: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      ownerAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      name: {
        allowNull: true,
        type: DataTypes.STRING,
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
      lastProcessedVersion: {
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `ecosystem_main_accounts`,
    },
    transformFieldArrayToSnakeCase(['ownerAddress']),
    {
      name: 'idx_ecosystem_main_accounts_owner_address',
    },
  );
}

async function createProjectsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `projects`,
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        primaryKey: true,
        type: DataTypes.STRING,
      },
      isValid: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
      },
      isVisible: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
      },
      name: {
        allowNull: true,
        type: DataTypes.STRING,
      },
      verificationStatus: {
        allowNull: false,
        type: literal(`${schema}.project_verification_status`)
          .val as unknown as DataType,
      },
      ownerAddress: {
        allowNull: true,
        type: DataTypes.STRING,
      },
      ownerAccountId: {
        allowNull: true,
        type: DataTypes.STRING,
      },
      forge: {
        allowNull: true,
        type: literal(`${schema}.forges`).val as unknown as DataType,
      },
      url: {
        allowNull: true,
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
        allowNull: true,
        type: DataTypes.STRING,
      },
      lastProcessedIpfsHash: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      lastProcessedVersion: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      claimedAt: {
        allowNull: true,
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `projects`,
    },
    transformFieldArrayToSnakeCase(['ownerAddress']),
    {
      name: 'idx_projects_owner_address',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `projects`,
    },
    transformFieldArrayToSnakeCase(['verificationStatus']),
    {
      name: 'idx_projects_verification_status',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `projects`,
    },
    transformFieldArrayToSnakeCase(['url']),
    {
      name: 'idx_projects_url',
    },
  );
}

async function createAccountMetadataEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `account_metadata_emitted_events`,
    },
    transformFieldNamesToSnakeCase({
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `account_metadata_emitted_events`,
    },
    transformFieldArrayToSnakeCase(['accountId']),
    {
      name: 'idx_account_metadata_emitted_events_accountId',
    },
  );
}

async function createTransferEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `transfer_events`,
    },
    transformFieldNamesToSnakeCase({
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
    }),
  );
}

async function createSplitReceiversTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: `split_receivers`,
    },
    transformFieldNamesToSnakeCase({
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
        type: literal(`${schema}.account_type`).val as unknown as DataType,
      },
      senderAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      senderAccountType: {
        allowNull: false,
        type: literal(`${schema}.account_type`).val as unknown as DataType,
      },
      relationshipType: {
        allowNull: false,
        type: literal(`${schema}.relationship_type`).val as unknown as DataType,
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
    }),
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: `split_receivers`,
    },
    transformFieldArrayToSnakeCase(['receiverAccountId', 'senderAccountId']),
    {
      name: 'idx_split_receivers_receiver_sender',
    },
  );
  await queryInterface.addIndex(
    {
      schema,
      tableName: `split_receivers`,
    },
    transformFieldArrayToSnakeCase(['senderAccountId', 'receiverAccountId']),
    {
      name: 'idx_split_receivers_sender_receiver',
    },
  );
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.dropTable({
    schema,
    tableName: `owner_updated_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `splits_set_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `streams_set_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `stream_receiver_seen_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `squeezed_streams_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `split_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `given_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `sub_lists`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `drip_lists`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `ecosystem_main_accounts`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `projects`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `account_metadata_emitted_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `transfer_events`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `split_receivers`,
  });
  await queryInterface.dropTable({
    schema,
    tableName: `last_indexed_block`,
  });

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

export function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/^_/, '')
    .toLowerCase();
}

export function transformFieldNamesToSnakeCase<T extends Record<string, any>>(
  fields: T,
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [camelToSnake(key), value]),
  );
}

export function transformFieldArrayToSnakeCase(fields: string[]): string[] {
  return fields.map(camelToSnake);
}
