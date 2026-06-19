import { sql } from 'drizzle-orm';
import { integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizationStatusEnum, subscriptionStatusEnum } from '../../db/enums';
import { users } from '../users/users.model';
import { subscriptionPlans } from '../subscriptions/subscriptions.model';
import { regions, districts } from '../geo/geo.model';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  // SaaS subdomain (e.g. "chulquvar" → chulquvar.mahalla.uz)
  subdomain: text('subdomain').unique(),
  address: text('address'),
  logoUrl: text('logo_url'),
  // Structured geographic hierarchy: Respublika → Viloyat → Tuman → Mahalla
  regionId: uuid('region_id').references(() => regions.id, { onDelete: 'set null' }),
  districtId: uuid('district_id').references(() => districts.id, { onDelete: 'set null' }),
  // Legacy text fields (kept for search/display)
  city: text('city'),
  district: text('district'),
  totalAreaSqm: integer('total_area_sqm'),
  establishedAt: timestamp('established_at', { withTimezone: true }),
  // GeoJSON boundary (PostGIS GEOMETRY column added via raw migration)
  boundaryGeojson: jsonb('boundary_geojson'),
  phone: text('phone'),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  status: organizationStatusEnum('status').notNull().default('trial'),
  subscriptionPlanId: uuid('subscription_plan_id').references(() => subscriptionPlans.id, {
    onDelete: 'set null',
  }),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('trial'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  chairman: text('chairman'),
  chairmanPhone: text('chairman_phone'),
  populationCount: integer('population_count'),
  description: text('description'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  territoryId: uuid('territory_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

