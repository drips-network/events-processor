import { DataTypes, literal, type QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';
import type { DbSchema } from '../../core/types';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface = sequelize.getQueryInterface();

  await createTableIfNotExists(
    queryInterface,
    schema,
    'EcosystemMainAccounts',
    createEcosystemsTable,
  );
}

async function createEcosystemsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'EcosystemMainAccounts', schema },
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      isValid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      ownerAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      ownerAccountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      latestVotingRoundId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      creator: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      previousOwnerAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isVisible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      lastProcessedIpfsHash: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'EcosystemMainAccounts', schema },
    ['ownerAddress'],
    {
      name: 'IX_Ecosystems_ownerAddress',
      unique: false,
    },
  );
}

async function createTableIfNotExists(
  queryInterface: QueryInterface,
  schema: DbSchema,
  tableName: string,
  createFn: (queryInterface: QueryInterface, schema: DbSchema) => Promise<void>,
) {
  const tableFullName = { tableName, schema };

  const tableExists = await queryInterface
    .describeTable(tableFullName)
    .catch(() => null);
  if (!tableExists) {
    await createFn(queryInterface, schema);
  }
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.dropTable({ tableName: 'CreatedSplitsEvents', schema });
  await queryInterface.dropTable({
    tableName: 'EcosystemMainAccounts',
    schema,
  });
}
