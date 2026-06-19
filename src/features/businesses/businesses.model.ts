import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.model';
import { users } from '../users/users.model';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const businessVerificationStatusEnum = pgEnum('business_verification_status', [
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED',
]);

export const businessDocumentStatusEnum = pgEnum('business_document_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const businessDocumentTypeEnum = pgEnum('business_document_type', [
  'TAX_REGISTRATION',
  'LICENSE',
  'CERTIFICATE',
  'OTHER',
]);

export const businessMediaTypeEnum = pgEnum('business_media_type', [
  'IMAGE',
  'VIDEO',
]);

export const businessOrderStatusEnum = pgEnum('business_order_status', [
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERING',
  'COMPLETED',
  'CANCELLED',
]);

// Drives type-aware catalog behaviour (menu vs products vs services vs booking).
export const businessKindEnum = pgEnum('business_kind', [
  'food', 'retail', 'service', 'venue', 'other',
]);

export const reservationStatusEnum = pgEnum('reservation_status', [
  'pending', 'confirmed', 'cancelled', 'seated', 'no_show', 'completed',
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const businessCategories = pgTable('business_categories', {
  id:             uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name:           text('name').notNull(),
  slug:           text('slug').notNull(),
  icon:           text('icon'),
  description:    text('description'),
  kind:           businessKindEnum('kind').notNull().default('other'),
  sortOrder:      integer('sort_order').default(0),
  isActive:       boolean('is_active').default(true),
  createdAt:      timestamp('created_at').defaultNow(),
});

export const businesses = pgTable('businesses', {
  id:             uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ownerUserId:    uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  categoryId:     uuid('category_id').references(() => businessCategories.id, { onDelete: 'set null' }),

  businessName:   text('business_name').notNull(),
  legalName:      text('legal_name'),

  phone:          text('phone'),
  additionalPhone:text('additional_phone'),
  telegram:       text('telegram'),
  website:        text('website'),

  address:        text('address'),
  latitude:       real('latitude'),
  longitude:      real('longitude'),

  description:    text('description'),

  logo:           text('logo'),
  coverImage:     text('cover_image'),

  verificationStatus: businessVerificationStatusEnum('verification_status').default('PENDING'),
  verifiedAt:         timestamp('verified_at'),
  verifiedById:       uuid('verified_by_id').references(() => users.id, { onDelete: 'set null' }),
  rejectionReason:    text('rejection_reason'),

  onlineOrderingEnabled: boolean('online_ordering_enabled').default(false),

  averageRating:  real('average_rating').default(0),
  totalReviews:   integer('total_reviews').default(0),
  totalViews:     integer('total_views').default(0),
  totalCalls:     integer('total_calls').default(0),

  status:    text('status', { enum: ['active', 'inactive', 'suspended'] }).default('active'),
  deletionRequestedAt: timestamp('deletion_requested_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const businessWorkingHours = pgTable('business_working_hours', {
  id:         uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  dayOfWeek:  integer('day_of_week').notNull(), // 0 Sun … 6 Sat
  openTime:   text('open_time'),               // HH:MM
  closeTime:  text('close_time'),
  isClosed:   boolean('is_closed').default(false),
});

export const businessDocuments = pgTable('business_documents', {
  id:          uuid('id').defaultRandom().primaryKey(),
  businessId:  uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  type:        businessDocumentTypeEnum('type').notNull(),
  fileUrl:     text('file_url').notNull(),
  status:      businessDocumentStatusEnum('status').default('PENDING'),
  reviewNote:  text('review_note'),
  createdAt:   timestamp('created_at').defaultNow(),
});

export const businessGallery = pgTable('business_gallery', {
  id:         uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  mediaType:  businessMediaTypeEnum('media_type').default('IMAGE'),
  fileUrl:    text('file_url').notNull(),
  title:      text('title'),
  sortOrder:  integer('sort_order').default(0),
  createdAt:  timestamp('created_at').defaultNow(),
});

export const businessServices = pgTable('business_services', {
  id:          uuid('id').defaultRandom().primaryKey(),
  businessId:  uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  title:       text('title').notNull(),
  description: text('description'),
  priceFrom:   numeric('price_from', { precision: 12, scale: 2 }),
  priceTo:     numeric('price_to', { precision: 12, scale: 2 }),
  createdAt:   timestamp('created_at').defaultNow(),
});

export const businessProducts = pgTable('business_products', {
  id:          uuid('id').defaultRandom().primaryKey(),
  businessId:  uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  title:       text('title').notNull(),
  description: text('description'),
  image:       text('image'),
  price:       numeric('price', { precision: 12, scale: 2 }),
  unit:        text('unit'),
  stock:       integer('stock'),
  // Food menu grouping (null for non-food). FK kept loose to avoid ordering issues.
  sectionId:   uuid('section_id'),
  portion:     text('portion'), // "1 kishilik", "500g"
  isAvailable: boolean('is_available').default(true),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
});

export const businessMenuSections = pgTable('business_menu_sections', {
  id:         uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name:       text('name').notNull(),
  sortOrder:  integer('sort_order').notNull().default(0),
  createdAt:  timestamp('created_at').defaultNow(),
});

// ─── Reservations (food/venue) ──────────────────────────────────────────────

export const businessReservationSettings = pgTable('business_reservation_settings', {
  businessId:      uuid('business_id').primaryKey().references(() => businesses.id, { onDelete: 'cascade' }),
  enabled:         boolean('enabled').notNull().default(false),
  slotMinutes:     integer('slot_minutes').notNull().default(60),
  partySizeMax:    integer('party_size_max'),
  leadMinMinutes:  integer('lead_min_minutes').notNull().default(0),
  note:            text('note'),
});

export const businessResources = pgTable('business_resources', {
  id:         uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name:       text('name').notNull(),
  capacity:   integer('capacity').notNull().default(2),
  isActive:   boolean('is_active').notNull().default(true),
  sortOrder:  integer('sort_order').notNull().default(0),
});

export const businessReservations = pgTable('business_reservations', {
  id:           uuid('id').defaultRandom().primaryKey(),
  businessId:   uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  residentId:   uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),
  resourceId:   uuid('resource_id').references(() => businessResources.id, { onDelete: 'set null' }),
  startsAt:     timestamp('starts_at', { withTimezone: true }).notNull(),
  partySize:    integer('party_size').notNull().default(1),
  status:       reservationStatusEnum('status').notNull().default('pending'),
  contactName:  text('contact_name'),
  contactPhone: text('contact_phone'),
  note:         text('note'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Multiple images per product. `business_products.image` stays as the cover
// (first image) for backward compatibility.
export const businessProductImages = pgTable('business_product_images', {
  id:         uuid('id').defaultRandom().primaryKey(),
  productId:  uuid('product_id').notNull().references(() => businessProducts.id, { onDelete: 'cascade' }),
  url:        text('url').notNull(),
  sortOrder:  integer('sort_order').notNull().default(0),
  createdAt:  timestamp('created_at').defaultNow(),
});

export const businessReviews = pgTable('business_reviews', {
  id:         uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),
  rating:     integer('rating').notNull(), // 1-5
  comment:    text('comment'),
  isHidden:   boolean('is_hidden').default(false),
  createdAt:  timestamp('created_at').defaultNow(),
});

export const businessFavorites = pgTable('business_favorites', {
  id:         uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt:  timestamp('created_at').defaultNow(),
}, t => [uniqueIndex('business_favorites_unique').on(t.businessId, t.residentId)]);

export const businessViewLogs = pgTable('business_view_logs', {
  id:         uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt:  timestamp('created_at').defaultNow(),
});

export const businessCallLogs = pgTable('business_call_logs', {
  id:         uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt:  timestamp('created_at').defaultNow(),
});

export const businessOrders = pgTable('business_orders', {
  id:              uuid('id').defaultRandom().primaryKey(),
  businessId:      uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  residentId:      uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),
  status:          businessOrderStatusEnum('status').default('NEW'),
  totalAmount:     numeric('total_amount', { precision: 12, scale: 2 }),
  notes:           text('notes'),
  deliveryAddress: text('delivery_address'),
  createdAt:       timestamp('created_at').defaultNow(),
  updatedAt:       timestamp('updated_at').defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type BusinessCategory    = typeof businessCategories.$inferSelect;
export type NewBusinessCategory = typeof businessCategories.$inferInsert;
export type Business            = typeof businesses.$inferSelect;
export type NewBusiness         = typeof businesses.$inferInsert;
export type BusinessReview      = typeof businessReviews.$inferSelect;
export type BusinessOrder       = typeof businessOrders.$inferSelect;
export type BusinessProduct     = typeof businessProducts.$inferSelect;
export type BusinessProductImage = typeof businessProductImages.$inferSelect;
export type BusinessMenuSection = typeof businessMenuSections.$inferSelect;
export type BusinessReservationSettings = typeof businessReservationSettings.$inferSelect;
export type BusinessResource    = typeof businessResources.$inferSelect;
export type BusinessReservation = typeof businessReservations.$inferSelect;
export type BusinessService     = typeof businessServices.$inferSelect;
