import { DataTypes, type QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';
import { DependencyType, type DbSchema } from '../../core/types';
import {} from '../../models';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface = sequelize.getQueryInterface();

  await createTableIfNotExists(
    queryInterface,
    schema,
    'SubLists',
    createSubListsTable,
  );

  await createTableIfNotExists(
    queryInterface,
    schema,
    'SubListSplitReceivers',
    createSubListSplitReceiversTable,
  );
}

async function createSubListsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'SubLists', schema },
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      ecosystemId: {
        // Foreign key
        type: DataTypes.STRING,
        allowNull: true,
        references: {
          model: 'Ecosystems',
          key: 'id',
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      lastProcessedIpfsHash: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'SubLists', schema },
    ['ecosystemId'],
    {
      name: 'IX_SubLists_ecosystemId',
      unique: false,
    },
  );
}

async function createSubListSplitReceiversTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'SubListSplitReceivers', schema },
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      fundeeImmutableSplitsId: {
        // Foreign key
        type: DataTypes.STRING,
        references: {
          model: 'SubLists',
          key: 'id',
        },
        allowNull: false,
      },
      funderProjectId: {
        // Foreign key
        type: DataTypes.STRING,
        references: {
          model: 'GitProjects',
          key: 'id',
        },
        allowNull: true,
      },
      funderDripListId: {
        // Foreign key
        type: DataTypes.STRING,
        references: {
          model: 'DripLists',
          key: 'id',
        },
        allowNull: true,
      },
      funderEcosystemId: {
        // Foreign key
        type: DataTypes.STRING,
        references: {
          model: 'Ecosystems',
          key: 'id',
        },
        allowNull: true,
      },
      weight: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM(...Object.values(DependencyType)),
        allowNull: false,
      },
      blockTimestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'SubListSplitReceivers', schema },
    ['fundeeImmutableSplitsId'],
    {
      name: 'IX_SubListSplitReceivers_fundeeImmutableSplitsId',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'SubListSplitReceivers', schema },
    ['funderProjectId'],
    {
      name: 'IX_SubListSplitReceivers_funderProjectId',
      where: {
        type: DependencyType.ProjectDependency,
      },
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'SubListSplitReceivers', schema },
    ['funderDripListId'],
    {
      name: 'IX_SubListSplitReceivers_funderDripListId',
      where: {
        type: DependencyType.DripListDependency,
      },
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'SubListSplitReceivers', schema },
    ['funderEcosystemId'],
    {
      name: 'IX_SubListSplitReceivers_funderEcosystemId',
      where: {
        type: DependencyType.EcosystemDependency,
      },
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

  await queryInterface.dropTable({
    tableName: 'SubListSplitReceivers',
    schema,
  });
}
