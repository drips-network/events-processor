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
      receivingAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      receivingAccountType: {
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
    transformFieldArrayToSnakeCase(['receivingAccountId']),
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

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  // Drop table
  await queryInterface.dropTable({
    schema,
    tableName: 'deadlines',
  });

  // Note: We cannot remove enum values from existing types in PostgreSQL.
  // The 'deadline' value will remain in the account_type enum.
}
