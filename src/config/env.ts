import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Apply pending DB migrations automatically on server boot (idempotent).
  // Set AUTO_MIGRATE=false to manage migrations manually via `npm run db:migrate`.
  AUTO_MIGRATE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.coerce.number().default(900), // 15 min (seconds)
  REFRESH_TOKEN_TTL: z.coerce.number().default(60 * 60 * 24 * 30), // 30 days

  // Seed — default platform super-admin (read from env, never hardcode in source)
  SEED_ADMIN_EMAIL: z.string().email().default('admin@crm.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin12345'),
  SEED_ADMIN_FIRST_NAME: z.string().default('Platform'),
  SEED_ADMIN_LAST_NAME: z.string().default('Admin'),

  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // SMTP (optional — falls back to console mock if not set)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@crm.local'),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),

  // Payme Subscribe API
  PAYME_MERCHANT_ID: z.string().optional(),
  PAYME_MERCHANT_KEY: z.string().optional(),
  PAYME_TEST_MODE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),

  // File uploads
  UPLOAD_DIR: z.string().default('./uploads'),
  APP_URL: z.string().default('http://localhost:4001'),
  // Public web (admin panel) URL — used to build links in emails (e.g. password reset).
  WEB_URL: z.string().default('http://localhost:5173'),

  // Eskiz SMS (phone OTP for mobile)
  ESKIZ_EMAIL: z.string().optional(),
  ESKIZ_PASSWORD: z.string().optional(),
  ESKIZ_TOKEN: z.string().optional(),
  ESKIZ_FROM: z.string().default('4546'),
  // Set to "true" to send real SMS even in development mode (requires valid ESKIZ_TOKEN)
  SEND_REAL_SMS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),

  // AI assistant — local Qwen3 model served via Ollama (data never leaves the box)
  AI_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  AI_PROVIDER: z.string().default('ollama'),
  AI_MODEL: z.string().default('qwen3:1.7b'),
  OLLAMA_HOST: z.string().default('http://127.0.0.1:11434'),
  AI_TIMEOUT_MS: z.coerce.number().default(60000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
