import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.model';
import { apartments } from '../buildings/buildings.model';

export const households = pgTable('households', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mahallaId: uuid('mahalla_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'set null' }),
  // headResidentId is set after residents are created (circular ref resolved via nullable FK)
  headResidentId: uuid('head_resident_id'),
  householdName: text('household_name'),
  happinessScore: integer('happiness_score'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
