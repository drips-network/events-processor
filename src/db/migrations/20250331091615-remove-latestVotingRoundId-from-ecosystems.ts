import { DataTypes, type QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.removeColumn(
    { tableName: 'EcosystemMainAccounts', schema },
    'latestVotingRoundId',
  );
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.addColumn(
    { tableName: 'EcosystemMainAccounts', schema },
    'latestVotingRoundId',
    {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  );
}
