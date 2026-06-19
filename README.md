# CRM Backend

Node.js + TypeScript + Fastify + Drizzle ORM + PostgreSQL. Feature-based architecture.

## Setup

```bash
npm install
cp .env.example .env   # edit DATABASE_URL and JWT secrets
```

## Database

```bash
npm run db:generate   # generate SQL migrations from schema
npm run db:migrate    # apply migrations
npm run db:seed       # seed plans, permissions, platform admin
```

Default platform admin (after seed): `admin@crm.local` / `Admin12345`.

## Run

```bash
npm run dev           # http://localhost:4000  (GET /health)
```

## Structure

```
src/
  config/      env validation
  db/          drizzle client, schema barrel, migrate, seed
  common/      middleware (auth, tenant, permission, errors), utils
  features/    auth, users, organizations, members, roles, permissions,
               menus, entities, subscriptions, audit
```

Each feature: `*.model.ts` (drizzle), `*.schema.ts` (zod), `*.service.ts`,
`*.controller.ts`, `*.routes.ts`.

## Auth

- argon2id password hashing
- JWT access token (short-lived) + opaque rotating refresh token
- both stored in httpOnly cookies
- `X-Organization-Id` header selects the active tenant
