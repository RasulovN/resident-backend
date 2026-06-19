import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../users/users.model';
import { organizations } from '../organizations/organizations.model';

// ─── Notification types ──────────────────────────────────────────────────────
// channel:     PLATFORM (super-admin → mahallas) | MAHALLA (mahalla admin → residents) | PERSONAL (system → user)
// type:        notification category shown in the mobile app
// targetType:  ALL (all org members) | SPECIFIC_USERS (explicit userIds list)
// status:      DRAFT → SCHEDULED / SENT / CANCELLED

export const notifications = pgTable('notifications', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId:         uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  title:         text('title').notNull(),
  body:          text('body').notNull(),
  type:          text('type').notNull().default('ANNOUNCEMENT'),
  channel:       text('channel').notNull().default('MAHALLA'),
  targetType:    text('target_type').notNull().default('ALL'),
  targetUserIds: jsonb('target_user_ids').$type<string[]>().notNull().default([]),
  targetFilter:  jsonb('target_filter').$type<Record<string, unknown>>().default({}),
  deepLink:      text('deep_link'),
  imageUrl:      text('image_url'),
  status:        text('status').notNull().default('DRAFT'),
  scheduledAt:   timestamp('scheduled_at', { withTimezone: true }),
  sentAt:        timestamp('sent_at', { withTimezone: true }),
  deliveryCount: jsonb('delivery_count').$type<{ total: number; delivered: number; read: number }>()
                   .notNull().default({ total: 0, delivered: 0, read: 0 }),
  createdById:   uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationDeliveries = pgTable('notification_deliveries', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  notificationId: uuid('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isRead:         boolean('is_read').notNull().default(false),
  readAt:         timestamp('read_at', { withTimezone: true }),
  deliveredAt:    timestamp('delivered_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userDevices = pgTable('user_devices', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pushToken:  text('push_token').notNull(),
  platform:   text('platform').notNull().default('android'),
  deviceId:   text('device_id').notNull(),
  isActive:   boolean('is_active').notNull().default(true),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationTemplates = pgTable('notification_templates', {
  id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId:     uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  title:     text('title').notNull(),
  body:      text('body').notNull(),
  type:      text('type').notNull().default('ANNOUNCEMENT'),
  variables: jsonb('variables').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Notification        = typeof notifications.$inferSelect;
export type NewNotification     = typeof notifications.$inferInsert;
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
export type UserDevice          = typeof userDevices.$inferSelect;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
