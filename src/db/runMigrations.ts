import type { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import logger from '../core/logger';
import getSchema from '../utils/getSchema';

export async function runMigrations(sequelize: Sequelize): Promise<void> {
  const schema = getSchema();

  // Ensure schema exists before running migrations
  await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

  const migrator = new Umzug({
    migrations: {
      glob: './dist/src/db/migrations/*.js',
    },
    context: sequelize,
    storage: new SequelizeStorage({ sequelize, schema: getSchema() }),
    logger: console,
  });

  // Apply any pending migrations.
  const migrations = await migrator.up();

  if (migrations.length > 0) {
    const appliedNames = migrations.map((m) => m.name).join(', ');
    logger.info(`Applied migrations: ${appliedNames}`);
  } else {
    logger.info(
      'No migrations were applied. The database is already up-to-date. If you expected migrations to be applied, ensure that you run "npm run build" before starting the server.',
    );
  }
}
