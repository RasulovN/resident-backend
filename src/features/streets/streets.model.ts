import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.model';

export const streets = pgTable('streets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mahallaId: uuid('mahalla_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameRu: text('name_ru'),
  slug: text('slug').notNull(),
  district: text('district'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Street = typeof streets.$inferSelect;
export type NewStreet = typeof streets.$inferInsert;
