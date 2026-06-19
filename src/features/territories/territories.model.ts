import { sql } from 'drizzle-orm';
import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const mahallaTerritories = pgTable('mahalla_territories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  number: integer('number').notNull().unique(),
  name: text('name').notNull(),
  district: text('district').notNull(),
  svgPath: text('svg_path').notNull(),
  centerX: numeric('center_x', { precision: 8, scale: 2 }).notNull(),
  centerY: numeric('center_y', { precision: 8, scale: 2 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MahallaTerritory = typeof mahallaTerritories.$inferSelect;
