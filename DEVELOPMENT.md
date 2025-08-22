# 🗂️ Database Migrations

## 🛠️ Creating a New Migration

To generate a new migration, run:

```bash
npm run db:create-migration -- --name your_migration_name
```

This will create a new file in `src/db/migrations`.

Rename the file extension from `.js` to `.ts`, and implement your migration using the following structure:

```ts
import { QueryInterface } from 'sequelize';

export async function up({ context: sequelize }: any): Promise<void> {
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  // Add your migration changes here.
}

export async function down({ context: sequelize }: any): Promise<void> {
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  // Add your revert logic here.
}
```

Sequelize does not fully support TypeScript out of the box. Manual steps like renaming and typing are required...

> ⚠️ Make sure the project is built before running this scripts, as it uses the compiled .js files under dist.

---

## 🚀 Running Migrations

Migrations do **not** run automatically. To apply them:

1. **Clean the project**

   ```bash
   npm run clean
   ```

2. **Build the project**

   ```bash
   npm run build
   ```

3. **Run pending migrations**

   ```bash
   npm run db:run-migrations
   ```

🤓 Alternatively, use:

```bash
npm run dev:db:run-migrations
```

This runs all the above steps in one go.

## 🔁 Reverting the Last Migration

To undo the most recently applied migration:

```bash
npm run db:revert-migration
```

> ⚠️ Make sure the project is built before running this script, as it uses the compiled .js files under dist.

## 📋 Checking Migration Status

To view the status of all migrations (which ones have been applied and which are pending), run:

```bash
npm run dev:db:log-pending-migrations
```

This will output a list of migrations with their current status:

- `up` indicates the migration has been applied.
- `down` indicates the migration is still pending.
