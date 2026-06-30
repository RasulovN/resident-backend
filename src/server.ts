import { buildApp } from './app';
import { env } from './config/env';
import { verifySmtp } from './common/utils/mailer';
import { runMigrations } from './db/migrate';

async function main() {
  // Keep the database schema in sync automatically on every boot. Idempotent —
  // already-applied migrations are skipped, so pm2 restarts / redeploys stay safe.
  // Disable with AUTO_MIGRATE=false to run `npm run db:migrate` manually instead.
  if (env.AUTO_MIGRATE) {
    try {
      await runMigrations();
    } catch (err) {
      console.error(
        '❌ Auto-migration failed — refusing to start with an out-of-date schema.',
        err,
      );
      process.exit(1);
    }
  }

  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Verify the mailer once at boot so bad SMTP credentials surface immediately
  // (otherwise they only show up the first time an email is attempted).
  if (env.SMTP_HOST) {
    const ok = await verifySmtp();
    if (ok) {
      console.log(`✅ SMTP ready — sending from ${env.SMTP_FROM} via ${env.SMTP_HOST}`);
    } else {
      console.warn(
        `⚠️  SMTP login FAILED for ${env.SMTP_USER} on ${env.SMTP_HOST}. ` +
          `Emails (parol tiklash, email tasdiqlash) will NOT be delivered — they fall back to the console. ` +
          `Fix: enable 2-Step Verification on the Google account and set SMTP_PASS to a fresh 16-char ` +
          `Gmail App Password (https://myaccount.google.com/apppasswords).`,
      );
    }
  } else {
    console.warn('⚠️  SMTP not configured (SMTP_HOST unset) — emails fall back to the console.');
  }
}

main();
