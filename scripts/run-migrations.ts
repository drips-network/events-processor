import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import getSchema from '../src/utils/getSchema';
import logger from '../src/core/logger';

export async function runMigrations(): Promise<void> {
  const sequelize = new Sequelize(
    process.env.POSTGRES_CONNECTION_STRING as string,
    {
      dialect: 'postgres',
      logging: false,
      timezone: 'UTC',
    },
  );

  const schema = getSchema();

  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT FROM pg_database WHERE datname = 'dripsdb'
      ) THEN
        CREATE DATABASE "dripsdb";
      END IF;
    END
    $$;
  `);
  await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

  const migrator = new Umzug({
    migrations: {
      glob: './dist/src/db/migrations/*.js', // Migrations always run from the build!
    },
    context: sequelize,
    storage: new SequelizeStorage({ sequelize, schema: getSchema() }),
    logger: console,
  });

  try {
    const migrations = await migrator.up();

    if (migrations.length > 0) {
      const appliedNames = migrations.map((m) => m.name).join(', ');
      logger.info(
        `✅ Applied ${migrations.length} migration${migrations.length > 1 ? 's' : ''}:\n  - ${appliedNames.split(', ').join('\n  - ')}`,
      );
    } else {
      logger.info(
        'No migrations were applied. The database is already up-to-date. If you expected migrations to be applied, ensure that you run "npm run build" before starting the server.',
      );
    }
  } finally {
    sequelize.close();
  }
}

runMigrations().catch((error) => {
  logger.info('Error running migrations:', error);

  throw error;
});
