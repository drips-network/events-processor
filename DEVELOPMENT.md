# Database Migrations

## Running Migrations

Migrations do not run automatically. To run the migrations:

1. Build the TypeScript code: `npm run build`

2. Run the migrations: `npm run db:run-migrations`.

## Creating a New Migration

To generate a new migration: `npm run db:create-migration -- --name your_migration_name`

This creates a new migration file in src/db/migrations — just add your changes there.
