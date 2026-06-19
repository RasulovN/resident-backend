import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { userStatusEnum } from '../../db/enums';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  username: text('username').unique(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  status: userStatusEnum('status').notNull().default('pending'),
  emailVerified: boolean('email_verified').notNull().default(false),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  // Legal: consent to Terms of Use & Privacy Policy (captured at registration).
  termsAccepted: boolean('terms_accepted').notNull().default(false),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
