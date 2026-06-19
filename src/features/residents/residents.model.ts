import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  employmentStatusEnum,
  genderEnum,
  residentStatusEnum,
} from '../../db/enums';
import { organizations } from '../organizations/organizations.model';
import { households } from '../households/households.model';
import { apartments } from '../buildings/buildings.model';
import { users } from '../users/users.model';

export const residents = pgTable('residents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mahallaId: uuid('mahalla_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'set null' }),
  // Link to system user (mobile app account) — optional
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // Personal info
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  middleName: text('middle_name'),
  phone: text('phone'),
  phone2: text('phone2'),
  email: text('email'),
  passportSeries: text('passport_series'),
  passportNumber: text('passport_number'),
  pinfl: text('pinfl').unique(),
  birthDate: timestamp('birth_date', { withTimezone: true }),
  gender: genderEnum('gender'),

  // Social profile
  educationLevel: text('education_level'),
  occupation: text('occupation'),
  employmentStatus: employmentStatusEnum('employment_status'),
  socialStatus: text('social_status'),
  languages: jsonb('languages').$type<string[]>(),
  digitalSkillLevel: text('digital_skill_level'),
  disabilityType: text('disability_type'),
  disabilityNotes: text('disability_notes'),

  // Extras
  hobbies: jsonb('hobbies').$type<string[]>(),
  interests: jsonb('interests').$type<string[]>(),
  happinessScore: integer('happiness_score'),
  hasVehicle: boolean('has_vehicle').notNull().default(false),

  // Status
  status: residentStatusEnum('status').notNull().default('active'),
  registeredAt: timestamp('registered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const populationEvents = pgTable('population_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mahallaId: uuid('mahalla_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').references(() => residents.id, { onDelete: 'set null' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  eventDate: timestamp('event_date', { withTimezone: true }).notNull(),
  notes: text('notes'),
  documents: jsonb('documents'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const residentRelocations = pgTable('resident_relocations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  residentId: uuid('resident_id')
    .notNull()
    .references(() => residents.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  fromMahallaId: uuid('from_mahalla_id').references(() => organizations.id, { onDelete: 'set null' }),
  toMahallaId: uuid('to_mahalla_id').references(() => organizations.id, { onDelete: 'set null' }),
  fromApartmentId: uuid('from_apartment_id').references(() => apartments.id, { onDelete: 'set null' }),
  toApartmentId: uuid('to_apartment_id').references(() => apartments.id, { onDelete: 'set null' }),
  relocationType: text('relocation_type').notNull().default('internal'),
  reason: text('reason'),
  relocationDate: timestamp('relocation_date', { withTimezone: true }),
  fromAdminApprovedAt: timestamp('from_admin_approved_at', { withTimezone: true }),
  toAdminApprovedAt: timestamp('to_admin_approved_at', { withTimezone: true }),
  status: text('status').notNull().default('pending'),
  documents: jsonb('documents'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Resident = typeof residents.$inferSelect;
export type NewResident = typeof residents.$inferInsert;
export type PopulationEvent = typeof populationEvents.$inferSelect;
export type ResidentRelocation = typeof residentRelocations.$inferSelect;
