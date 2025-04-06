import { DataTypes, type QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.sequelize.query(`
    ALTER TYPE "${schema}"."enum_SubListSplitReceivers_type" ADD VALUE IF NOT EXISTS 'EcosystemDependency';
  `);
  await queryInterface.sequelize.query(`
    ALTER TYPE "${schema}"."enum_RepoDriverSplitReceivers_type" ADD VALUE IF NOT EXISTS 'EcosystemDependency';
  `);
  await queryInterface.sequelize.query(`
    ALTER TYPE "${schema}"."enum_DripListSplitReceivers_type" ADD VALUE IF NOT EXISTS 'EcosystemDependency';
  `);
  await queryInterface.sequelize.query(`
    ALTER TYPE "${schema}"."enum_AddressDriverSplitReceivers_type" ADD VALUE IF NOT EXISTS 'EcosystemDependency';
  `);

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'creator',
    {
      type: DataTypes.STRING,
      allowNull: true,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'ownerAddress',
    {
      type: DataTypes.STRING,
      allowNull: true,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'ownerAccountId',
    {
      type: DataTypes.STRING,
      allowNull: true,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'previousOwnerAddress',
    {
      type: DataTypes.STRING,
      allowNull: true,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'isVisible',
    {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
  );
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'creator',
    {
      type: DataTypes.STRING,
      allowNull: false,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'ownerAddress',
    {
      type: DataTypes.STRING,
      allowNull: false,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'ownerAccountId',
    {
      type: DataTypes.STRING,
      allowNull: false,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'previousOwnerAddress',
    {
      type: DataTypes.STRING,
      allowNull: false,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'EcosystemMainIdentities', schema },
    'isVisible',
    {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  );
}
