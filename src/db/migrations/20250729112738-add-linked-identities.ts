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
    ALTER TYPE ${schema}.account_type ADD VALUE IF NOT EXISTS 'linked_identity';
  `);

  // Add new relationship type to enum
  await queryInterface.sequelize.query(`
    ALTER TYPE ${schema}.relationship_type ADD VALUE IF NOT EXISTS 'identity_owner';
  `);

  // Create linked identity types enum
  await queryInterface.sequelize.query(`
    CREATE TYPE ${schema}.linked_identity_types AS ENUM (
      'orcid'
    );
  `);

  await createLinkedIdentitiesTable(queryInterface, schema);
}

async function createLinkedIdentitiesTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    {
      schema,
      tableName: 'linked_identities',
    },
    transformFieldNamesToSnakeCase({
      accountId: {
        primaryKey: true,
        type: DataTypes.STRING,
      },
      identityType: {
        allowNull: false,
        type: literal(`${schema}.linked_identity_types`)
          .val as unknown as DataType,
      },
      ownerAddress: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      ownerAccountId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      isLinked: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
      },
      lastProcessedVersion: {
        allowNull: false,
        type: DataTypes.STRING,
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
      tableName: 'linked_identities',
    },
    transformFieldArrayToSnakeCase(['ownerAddress']),
    {
      name: 'idx_linked_identities_owner_address',
    },
  );

  await queryInterface.addIndex(
    {
      schema,
      tableName: 'linked_identities',
    },
    transformFieldArrayToSnakeCase(['identityType']),
    {
      name: 'idx_linked_identities_identity_type',
    },
  );
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  // Drop table
  await queryInterface.dropTable({
    schema,
    tableName: 'linked_identities',
  });

  // Drop linked identity types enum
  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS ${schema}.linked_identity_types;
  `);

  // Note: We cannot remove enum values from existing types in PostgreSQL.
  // The 'linked_identity' and 'identity_owner' values will remain in the enums.
}
