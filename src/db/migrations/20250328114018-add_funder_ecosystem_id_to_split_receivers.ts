import { DataTypes, type QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.addColumn(
    { tableName: 'RepoDriverSplitReceivers', schema },
    'funderEcosystemMainAccountId',
    {
      type: DataTypes.STRING,
      references: {
        model: 'EcosystemMainIdentities',
        key: 'id',
      },
      allowNull: true,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'RepoDriverSplitReceivers', schema },
    ['funderEcosystemMainAccountId'],
    {
      name: 'IX_RepoDriverSplitReceivers_funderEcosystemId',
      where: {
        type: 'EcosystemDependency',
      },
      unique: false,
    },
  );

  await queryInterface.addColumn(
    { tableName: 'RepoDriverSplitReceivers', schema },
    'funderSubListId',
    {
      type: DataTypes.STRING,
      references: {
        model: 'SubLists',
        key: 'id',
      },
      allowNull: true,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'RepoDriverSplitReceivers', schema },
    ['funderSubListId'],
    {
      name: 'IX_RepoDriverSplitReceivers_funderSubListId',
      where: {
        type: 'EcosystemDependency',
      },
      unique: false,
    },
  );

  await queryInterface.addColumn(
    { tableName: 'DripListSplitReceivers', schema },
    'funderEcosystemMainAccountId',
    {
      type: DataTypes.STRING,
      references: {
        model: 'EcosystemMainIdentities',
        key: 'id',
      },
      allowNull: true,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'DripListSplitReceivers', schema },
    ['funderEcosystemMainAccountId'],
    {
      name: 'IX_DripListSplitReceivers_funderEcosystemId',
      where: {
        type: 'EcosystemDependency',
      },
      unique: false,
    },
  );

  await queryInterface.addColumn(
    { tableName: 'DripListSplitReceivers', schema },
    'funderSubListId',
    {
      type: DataTypes.STRING,
      references: {
        model: 'SubLists',
        key: 'id',
      },
      allowNull: true,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'DripListSplitReceivers', schema },
    ['funderSubListId'],
    {
      name: 'IX_DripListSplitReceivers_funderSubListId',
      where: {
        type: 'EcosystemDependency',
      },
      unique: false,
    },
  );

  await queryInterface.addColumn(
    { tableName: 'AddressDriverSplitReceivers', schema },
    'funderEcosystemMainAccountId',
    {
      type: DataTypes.STRING,
      references: {
        model: 'EcosystemMainIdentities',
        key: 'id',
      },
      allowNull: true,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'AddressDriverSplitReceivers', schema },
    ['funderEcosystemMainAccountId'],
    {
      name: 'IX_AddressDriverSplitReceivers_funderEcosystemId',
      where: {
        type: 'EcosystemDependency',
      },
      unique: false,
    },
  );

  await queryInterface.addColumn(
    { tableName: 'AddressDriverSplitReceivers', schema },
    'funderSubListId',
    {
      type: DataTypes.STRING,
      references: {
        model: 'SubLists',
        key: 'id',
      },
      allowNull: true,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'AddressDriverSplitReceivers', schema },
    ['funderSubListId'],
    {
      name: 'IX_AddressDriverSplitReceivers_funderSubListId',
      where: {
        type: 'EcosystemDependency',
      },
      unique: false,
    },
  );
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.removeColumn(
    { tableName: 'RepoDriverSplitReceivers', schema },
    'funderEcosystemMainAccountId',
  );
  await queryInterface.removeIndex(
    { tableName: 'RepoDriverSplitReceivers', schema },
    'IX_RepoDriverSplitReceivers_funderEcosystemId',
  );
  await queryInterface.removeColumn(
    { tableName: 'DripListSplitReceivers', schema },
    'funderEcosystemMainAccountId',
  );
  await queryInterface.removeIndex(
    { tableName: 'DripListSplitReceivers', schema },
    'IX_DripListSplitReceivers_funderEcosystemId',
  );
  await queryInterface.removeColumn(
    { tableName: 'AddressDriverSplitReceivers', schema },
    'funderEcosystemMainAccountId',
  );
  await queryInterface.removeIndex(
    { tableName: 'AddressDriverSplitReceivers', schema },
    'IX_AddressDriverSplitReceivers_funderEcosystemId',
  );
}
