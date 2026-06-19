import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../users/users.model';

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  body: text('body').notNull(),
  // 'info' | 'warning' | 'critical'
  priority: text('priority').notNull().default('info'),
  // 'all' | 'specific'
  targetType: text('target_type').notNull().default('all'),
  targetOrgIds: jsonb('target_org_ids').$type<string[]>().notNull().default([]),
  // 'draft' | 'published'
  status: text('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
