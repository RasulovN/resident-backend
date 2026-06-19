import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  inquiryStatusEnum,
  inquiryCategoryEnum,
  inquiryPriorityEnum,
  inquiryEventTypeEnum,
} from '../../db/enums';
import { organizations } from '../organizations/organizations.model';
import { users } from '../users/users.model';

/** A single file/image attached to an inquiry or one of its events. */
export type InquiryAttachment = {
  url: string;
  name: string;
  /** generic kind for icon/preview decisions */
  kind: 'image' | 'file';
  mimeType?: string;
  size?: number;
};

export const inquiries = pgTable('inquiries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  /** Human-readable case number, e.g. M-2026-000123 */
  ticketNumber: text('ticket_number').notNull(),
  /** The resident (users.id) who submitted it; null if submitted on their behalf */
  residentId: uuid('resident_id').references(() => users.id, { onDelete: 'set null' }),

  category: inquiryCategoryEnum('category').notNull().default('COMPLAINT'),
  priority: inquiryPriorityEnum('priority').notNull().default('MEDIUM'),
  status: inquiryStatusEnum('status').notNull().default('NEW'),

  title: text('title').notNull(),
  description: text('description').notNull(),
  /** Optional free-text address / location of the issue */
  location: text('location'),
  contactPhone: text('contact_phone'),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  attachments: jsonb('attachments').$type<InquiryAttachment[]>().notNull().default([]),

  /** Staff member responsible for the case */
  assignedToId: uuid('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),

  /** Legal review window. Default 15 days; up to 30 with additional study; may be extended. */
  deadlineDays: integer('deadline_days').notNull().default(15),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  extensionCount: integer('extension_count').notNull().default(0),
  lastExtensionReason: text('last_extension_reason'),

  escalated: boolean('escalated').notNull().default(false),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  escalatedById: uuid('escalated_by_id').references(() => users.id, { onDelete: 'set null' }),
  escalationReason: text('escalation_reason'),

  /** Final written answer given to the applicant */
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
  closedAt: timestamp('closed_at', { withTimezone: true }),

  /** Resident satisfaction rating (1-5) after resolution */
  rating: integer('rating'),
  ratingComment: text('rating_comment'),

  /** Updated on every event so lists can sort by latest activity */
  lastEventAt: timestamp('last_event_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Timeline of everything that happens to an inquiry — status changes, comments,
 * deadline extensions, escalations. Events with `isInternal = true` are visible
 * only to staff; everything else is shown to the applicant in their mobile app.
 */
export const inquiryEvents = pgTable('inquiry_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  inquiryId: uuid('inquiry_id')
    .notNull()
    .references(() => inquiries.id, { onDelete: 'cascade' }),
  type: inquiryEventTypeEnum('type').notNull(),
  /** Who triggered the event (users.id); null for system-generated events */
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  /** resident | staff | system — drives avatar/labeling without an extra join */
  authorRole: text('author_role').notNull().default('staff'),
  body: text('body'),
  fromStatus: inquiryStatusEnum('from_status'),
  toStatus: inquiryStatusEnum('to_status'),
  isInternal: boolean('is_internal').notNull().default(false),
  attachments: jsonb('attachments').$type<InquiryAttachment[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
export type InquiryEvent = typeof inquiryEvents.$inferSelect;
export type NewInquiryEvent = typeof inquiryEvents.$inferInsert;
