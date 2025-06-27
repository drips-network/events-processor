/* eslint-disable no-console */

import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import getSchema from '../src/utils/getSchema';

export async function revertLastMigration(): Promise<void> {
  const connectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "'POSTGRES_CONNECTION_STRING' environment variable is missing.",
    );
  }

  const sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false,
  });

  const schema = getSchema();

  await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

  const migrator = new Umzug({
    migrations: {
      glob: './dist/src/db/migrations/*.js', // Migrations must be built before running.
    },
    context: sequelize,
    storage: new SequelizeStorage({
      sequelize,
      schema,
      tableName: 'sequelize_meta',
    }),
    logger: console,
  });

  try {
    const reverted = await migrator.down();

    if (reverted.length) {
      console.info(`🔁 Reverted migration: ${reverted[0]?.name}`);
    } else {
      console.info(
        'No migration was reverted. The database is already at the base state.',
      );
    }
  } finally {
    sequelize.close();
  }
}

revertLastMigration().catch((error) => {
  console.error(`❌ Migration revert error: ${error.message}`, {
    stack: error.stack,
    cause: (error as any).cause,
  });

  process.exitCode = 1;
});
