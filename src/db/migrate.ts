import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { pathToFileURL } from 'node:url';
import { db, pool } from './client';

/**
 * Apply all pending Drizzle migrations from ./drizzle.
 *
 * Idempotent — already-applied migrations are skipped, so this is safe to call
 * on every server boot. Does NOT close the connection pool, so the caller
 * (server.ts) can keep using `db` afterwards. The standalone CLI run below
 * closes the pool so the process can exit.
 */
export async function runMigrations(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('⏳ Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  // eslint-disable-next-line no-console
  console.log('✅ Migrations complete');
}

// When invoked directly (`npm run db:migrate` / `tsx src/db/migrate.ts`),
// run once and close the pool so the process exits. Importing this module
// (e.g. from server.ts) does NOT trigger migrations — only a direct run does.
const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('❌ Migration failed', err);
      process.exit(1);
    });
}
