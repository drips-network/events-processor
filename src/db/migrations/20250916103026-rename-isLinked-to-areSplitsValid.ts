import type { QueryInterface } from 'sequelize';
import getSchema from '../../utils/getSchema';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const qi: QueryInterface = sequelize.getQueryInterface();

  await qi.renameColumn(
    {
      schema,
      tableName: 'linked_identities',
    },
    'is_linked',
    'are_splits_valid',
  );
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const qi: QueryInterface = sequelize.getQueryInterface();

  await qi.renameColumn(
    {
      schema,
      tableName: 'linked_identities',
    },
    'are_splits_valid',
    'is_linked',
  );
}
