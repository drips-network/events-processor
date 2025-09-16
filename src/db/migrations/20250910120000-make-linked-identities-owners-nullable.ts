import type { QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const qi: QueryInterface = sequelize.getQueryInterface();

  await qi.sequelize.query(`
    ALTER TABLE ${schema}.linked_identities
    ALTER COLUMN owner_address DROP NOT NULL,
    ALTER COLUMN owner_account_id DROP NOT NULL,
    ALTER COLUMN is_linked SET DEFAULT false;
  `);
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const qi: QueryInterface = sequelize.getQueryInterface();

  await qi.sequelize.query(`
    ALTER TABLE ${schema}.linked_identities
    ALTER COLUMN is_linked DROP DEFAULT,
    ALTER COLUMN owner_address SET NOT NULL,
    ALTER COLUMN owner_account_id SET NOT NULL;
  `);
}
