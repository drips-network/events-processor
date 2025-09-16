import { DataTypes, literal } from 'sequelize';
import type { DataType, QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';
import type { DbSchema } from '../../core/types';
import {
  transformFieldNamesToSnakeCase,
  transformFieldArrayToSnakeCase,
} from './20250414133746-initial_create';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  // Add new account type to enum
  await queryInterface.sequelize.query(`
    ALTER TYPE ${schema}.account_type ADD VALUE IF NOT EXISTS 'deadline';
  `);

  await createDeadlinesTable(queryInterface, schema);
  await createAccountSeenEventsTable(queryInterface, schema);
}

async function createDeadlinesTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: 'deadlines',
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        primaryKey: true,
        type: DataTypes.STRING,
      },
      receiverAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      receiverAccountType: {
        allowNull: false,
        type: literal(`${schema}.account_type`).val as unknown as DataType,
      },
      claimableProjectId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      deadline: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      refundAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      refundAccountType: {
        allowNull: false,
        type: literal(`${schema}.account_type`).val as unknown as DataType,
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
      tableName: 'deadlines',
    },
    transformFieldArrayToSnakeCase(['receiverAccountId']),
    {
      name: 'idx_deadlines_receiving_account_id',
    },
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: 'deadlines',
    },
    transformFieldArrayToSnakeCase(['claimableProjectId']),
    {
      name: 'idx_deadlines_claimable_project_id',
    },
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: 'deadlines',
    },
    transformFieldArrayToSnakeCase(['refundAccountId']),
    {
      name: 'idx_deadlines_refund_account_id',
    },
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: 'deadlines',
    },
    transformFieldArrayToSnakeCase(['deadline']),
    {
      name: 'idx_deadlines_deadline',
    },
  );
}

async function createAccountSeenEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: 'account_seen_events',
    },
    transformFieldNamesToSnakeCase({
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
      accountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      repoAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      receiverAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      refundAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      deadline: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      blockTimestamp: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      blockNumber: {
        allowNull: false,
        type: DataTypes.INTEGER,
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

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  // Drop tables
  await queryInterface.dropTable({
    schema,
    tableName: 'account_seen_events',
  });

  await queryInterface.dropTable({
    schema,
    tableName: 'deadlines',
  });

  // Note: We cannot remove enum values from existing types in PostgreSQL.
  // The 'deadline' value will remain in the account_type enum.
}
