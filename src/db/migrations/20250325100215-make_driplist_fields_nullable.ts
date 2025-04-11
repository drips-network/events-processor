import { DataTypes, type QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
    'creator',
    {
      type: DataTypes.STRING,
      allowNull: true,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
    'ownerAddress',
    {
      type: DataTypes.STRING,
      allowNull: true,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
    'ownerAccountId',
    {
      type: DataTypes.STRING,
      allowNull: true,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
    'previousOwnerAddress',
    {
      type: DataTypes.STRING,
      allowNull: true,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
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
    { tableName: 'DripLists', schema },
    'creator',
    {
      type: DataTypes.STRING,
      allowNull: false,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
    'ownerAddress',
    {
      type: DataTypes.STRING,
      allowNull: false,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
    'ownerAccountId',
    {
      type: DataTypes.STRING,
      allowNull: false,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
    'previousOwnerAddress',
    {
      type: DataTypes.STRING,
      allowNull: false,
    },
  );

  await queryInterface.changeColumn(
    { tableName: 'DripLists', schema },
    'isVisible',
    {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  );
}
