import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  apartmentTypeEnum,
  buildingStatusEnum,
  buildingTypeEnum,
} from '../../db/enums';
import { organizations } from '../organizations/organizations.model';
import { streets } from '../streets/streets.model';

export const buildings = pgTable('buildings', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mahallaId: uuid('mahalla_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  streetId: uuid('street_id').references(() => streets.id, { onDelete: 'set null' }),
  name: text('name'),
  number: text('number').notNull(),
  buildingType: buildingTypeEnum('building_type').notNull().default('apartment_block'),
  floorsCount: integer('floors_count'),
  apartmentsCount: integer('apartments_count'),
  yearBuilt: integer('year_built'),
  // Coordinates stored as plain text (lat,lng) — PostGIS geometry via raw column
  latitude: text('latitude'),
  longitude: text('longitude'),
  modelUrl3d: text('model_url_3d'),
  status: buildingStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apartments = pgTable('apartments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  buildingId: uuid('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  floor: integer('floor'),
  number: text('number').notNull(),
  areaSqm: integer('area_sqm'),
  roomsCount: integer('rooms_count'),
  apartmentType: apartmentTypeEnum('apartment_type').notNull().default('apartment'),
  status: text('status').notNull().default('occupied'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
export type Apartment = typeof apartments.$inferSelect;
export type NewApartment = typeof apartments.$inferInsert;
