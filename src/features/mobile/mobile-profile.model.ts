import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../users/users.model';

/**
 * Self-reported address of a mobile resident, bound 1:1 to the user. Kept
 * separate from the official `residents` registry (which is admin-managed) so
 * residents can fill in their own location without touching domain records.
 */
export const residentAddresses = pgTable('resident_addresses', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  street: text('street'),
  building: text('building'),
  apartment: text('apartment'),
  household: text('household'),
  landmark: text('landmark'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Extended ("additional") resident profile data, bound 1:1 to the user. Split
 * from `mobile_profiles` so the core identity record stays lean and these
 * optional, survey-style fields evolve independently.
 */
export const residentDetails = pgTable('resident_details', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  educationLevel: text('education_level'),
  profession: text('profession'),
  employmentStatus: text('employment_status'),
  socialStatus: text('social_status'),
  languages: jsonb('languages').$type<string[]>().notNull().default([]),
  digitalSkill: text('digital_skill'),
  hobbies: text('hobbies'),
  happinessLevel: integer('happiness_level'),
  healthNotes: text('health_notes'),
  specialNeeds: text('special_needs'),
  hasCar: boolean('has_car').notNull().default(false),
  carModel: text('car_model'),
  carPlate: text('car_plate'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ResidentAddress = typeof residentAddresses.$inferSelect;
export type ResidentDetails = typeof residentDetails.$inferSelect;
