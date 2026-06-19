import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  providerVerificationStatusEnum,
  providerOrderStatusEnum,
  providerDocumentTypeEnum,
} from '../../db/enums';
import { organizations } from '../organizations/organizations.model';
import { users } from '../users/users.model';

export const serviceCategories = pgTable('service_categories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  icon: text('icon'),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const serviceProviders = pgTable('service_providers', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  businessName: text('business_name').notNull(),
  description: text('description'),
  phone: text('phone').notNull(),
  telegram: text('telegram'),
  experienceYears: integer('experience_years').notNull().default(0),
  avatar: text('avatar'),
  coverImage: text('cover_image'),
  verificationStatus: providerVerificationStatusEnum('verification_status').notNull().default('PENDING'),
  status: text('status').notNull().default('active'),
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }).notNull().default('0'),
  totalReviews: integer('total_reviews').notNull().default(0),
  totalOrders: integer('total_orders').notNull().default(0),
  serviceRadiusKm: integer('service_radius_km').notNull().default(5),
  isAvailable: boolean('is_available').notNull().default(true),
  rejectionReason: text('rejection_reason'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedById: uuid('verified_by_id').references(() => users.id, { onDelete: 'set null' }),
  deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerServices = pgTable('provider_services', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => serviceCategories.id, { onDelete: 'cascade' }),
  serviceName: text('service_name').notNull(),
  description: text('description'),
  minPrice: numeric('min_price', { precision: 12, scale: 2 }),
  maxPrice: numeric('max_price', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerDocuments = pgTable('provider_documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  type: providerDocumentTypeEnum('type').notNull(),
  fileUrl: text('file_url').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerPortfolio = pgTable('provider_portfolio', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  title: text('title'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerReviews = pgTable('provider_reviews', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  isHidden: boolean('is_hidden').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerAvailability = pgTable('provider_availability', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
});

export const providerOrders = pgTable('provider_orders', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => serviceCategories.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  location: text('location'),
  preferredTime: timestamp('preferred_time', { withTimezone: true }),
  status: providerOrderStatusEnum('status').notNull().default('NEW'),
  photos: jsonb('photos').$type<string[]>().notNull().default([]),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerCallLogs = pgTable('provider_call_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type ServiceProvider = typeof serviceProviders.$inferSelect;
export type ProviderService = typeof providerServices.$inferSelect;
export type ProviderDocument = typeof providerDocuments.$inferSelect;
export type ProviderPortfolio = typeof providerPortfolio.$inferSelect;
export type ProviderReview = typeof providerReviews.$inferSelect;
export type ProviderAvailability = typeof providerAvailability.$inferSelect;
export type ProviderOrder = typeof providerOrders.$inferSelect;
