import { type QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.sequelize.query(`
    CREATE TYPE "${schema}"."account_type" AS ENUM (
      'project',
      'dripList',
      'ecosystemMainAccount',
      'subList',
      'deadline',
      'address'
    );
  `);
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS "${schema}"."account_type";
  `);
}
