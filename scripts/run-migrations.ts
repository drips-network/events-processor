/* eslint-disable no-console */

import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import getSchema from '../src/utils/getSchema';

export async function runMigrations(): Promise<void> {
  const connectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "'POSTGRES_CONNECTION_STRING' environment variable is missing.",
    );
  }

  const sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
    },
  });

  const schema = getSchema();

  await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

  const migrator = new Umzug({
    migrations: {
      glob: './dist/src/db/migrations/*.js', // Migrations must be built before running.
    },
    context: sequelize,
    storage: new SequelizeStorage({ sequelize, schema }),
    logger: console,
  });

  try {
    const migrations = await migrator.up();

    if (migrations.length > 0) {
      const appliedNames = migrations.map((m) => m.name).join(', ');
      console.info(
        `✅ Applied ${migrations.length} migration${migrations.length > 1 ? 's' : ''}:\n  - ${appliedNames.split(', ').join('\n  - ')}`,
      );
    } else {
      console.info(
        'No migrations were applied. The database is already up-to-date. If you expected migrations to be applied, ensure that you run "npm run build" before starting the server.',
      );
    }
  } finally {
    sequelize.close();
  }
}

runMigrations().catch((error) => {
  console.error(`❌ Migration error: ${error.message}`, {
    stack: error.stack,
    cause: (error as any).cause,
  });

  process.exitCode = 1;
});
