import { pgTable, text, timestamp, uuid, boolean, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/users.model';

export const phoneOtps = pgTable('phone_otps', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  phone: text('phone').notNull(),
  code: text('code').notNull(),
  attempts: integer('attempts').notNull().default(0),
  verified: boolean('verified').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mobileProfiles = pgTable('mobile_profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  middleName: text('middle_name'),
  passportId: text('passport_id'),
  avatarUrl: text('avatar_url'),
  birthDate: timestamp('birth_date', { withTimezone: true }),
  gender: text('gender'),
  accountType: text('account_type').notNull().default('individual'),
  organizationName: text('organization_name'),
  inn: text('inn'),
  email: text('email'),
  // Privacy: whether others may see the user's phone / email on their profile.
  showPhone: boolean('show_phone').notNull().default(false),
  showEmail: boolean('show_email').notNull().default(false),
  selectedMahallaId: uuid('selected_mahalla_id'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  // Legal: consent to Terms of Use & Privacy Policy (captured at registration).
  termsAccepted: boolean('terms_accepted').notNull().default(false),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PhoneOtp = typeof phoneOtps.$inferSelect;
export type MobileProfile = typeof mobileProfiles.$inferSelect;
