import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const regions = pgTable('regions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),       // O'zbekcha
  nameRu: text('name_ru'),            // Ruscha
  code: text('code').unique(),        // qashqadaryo, toshkent-shahri, etc.
  sortOrder: integer('sort_order').notNull().default(0),
});

export const districts = pgTable('districts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  regionId: uuid('region_id')
    .notNull()
    .references(() => regions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),       // O'zbekcha
  nameRu: text('name_ru'),            // Ruscha
  isCity: boolean('is_city').notNull().default(false), // Shahar yoki tuman
  sortOrder: integer('sort_order').notNull().default(0),
});

export type Region = typeof regions.$inferSelect;
export type District = typeof districts.$inferSelect;
