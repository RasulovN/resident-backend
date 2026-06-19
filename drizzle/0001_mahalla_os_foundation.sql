-- =============================================================================
-- Mahalla OS Foundation Migration
-- NOTE: Bu fayl Drizzle Kit tomonidan avtomatik qo'llanilmaydi.
-- Quyidagi buyruqlarni ketma-ket ishlatib migration'ni to'g'ri yarating:
--
--   cd backend
--   npm run db:generate   (Drizzle modelga asosida migration yaratadi)
--   npm run db:migrate    (migration'ni ishga tushiradi)
--   npm run db:seed       (yangi rollar va ruxsatlarni qo'shadi)
--
-- Yoki quyidagi SQL'ni to'g'ridan-to'g'ri PostgreSQL'da bajaring:
-- =============================================================================

-- 1. PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. organizations jadvaliga yangi maydonlar qo'shish
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "subdomain" text,
  ADD COLUMN IF NOT EXISTS "city" text,
  ADD COLUMN IF NOT EXISTS "district" text,
  ADD COLUMN IF NOT EXISTS "total_area_sqm" integer,
  ADD COLUMN IF NOT EXISTS "established_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "boundary_geojson" jsonb,
  ADD COLUMN IF NOT EXISTS "phone" text;

-- 3. Unique constraint on subdomain
ALTER TABLE "organizations"
  ADD CONSTRAINT IF NOT EXISTS "organizations_subdomain_unique" UNIQUE ("subdomain");

-- 4. Index for fast SaaS routing
CREATE INDEX IF NOT EXISTS "organizations_subdomain_idx" ON "organizations" ("subdomain");
