import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.model';
import { users } from '../users/users.model';

// owner = room creator, admin = mahalla moderator, member = ordinary resident
export const chatMemberRoleEnum = pgEnum('chat_member_role', ['owner', 'admin', 'member']);

// Message payload kind. Attachments carry file metadata; text uses `body`.
export const chatMessageKindEnum = pgEnum('chat_message_kind', ['text', 'image', 'file', 'audio']);

// One unified structure for all conversations:
//  - mahalla: the community chat of an organization
//  - group:   a user-created group (Telegram-style)
//  - dm:      a 1-to-1 direct message between two users
export const chatRoomTypeEnum = pgEnum('chat_room_type', ['mahalla', 'group', 'dm']);

export const chatRooms = pgTable('chat_rooms', {
  id:             uuid('id').defaultRandom().primaryKey(),
  // Nullable: DMs and cross-mahalla groups need not belong to an organization.
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  type:           chatRoomTypeEnum('type').notNull().default('group'),
  title:          text('title').notNull().default(''),
  description:    text('description'),
  avatarUrl:      text('avatar_url'),
  // For DMs: stable sorted "userA:userB" key so a pair maps to one room.
  dmKey:          text('dm_key'),
  createdBy:      uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  isActive:       boolean('is_active').notNull().default(true),
  // When locked, only owners/admins may post (announcement channel mode).
  isLocked:       boolean('is_locked').notNull().default(false),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  dmKeyUniq: uniqueIndex('chat_rooms_dm_key_uniq').on(t.dmKey),
}));

export const chatMembers = pgTable('chat_members', {
  id:         uuid('id').defaultRandom().primaryKey(),
  roomId:     uuid('room_id').notNull().references(() => chatRooms.id, { onDelete: 'cascade' }),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:       chatMemberRoleEnum('role').notNull().default('member'),
  isMuted:    boolean('is_muted').notNull().default(false),   // muted by a moderator → cannot post
  isBanned:   boolean('is_banned').notNull().default(false),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
  joinedAt:   timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberUnique: uniqueIndex('chat_members_room_user_uniq').on(t.roomId, t.userId),
}));

export const chatMessages = pgTable('chat_messages', {
  id:        uuid('id').defaultRandom().primaryKey(),
  roomId:    uuid('room_id').notNull().references(() => chatRooms.id, { onDelete: 'cascade' }),
  senderId:  uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  kind:      chatMessageKindEnum('kind').notNull().default('text'),
  body:      text('body').notNull().default(''), // text content or attachment caption
  // Attachment metadata (null for plain text)
  fileUrl:     text('file_url'),
  fileName:    text('file_name'),
  fileSize:    integer('file_size'),
  mimeType:    text('mime_type'),
  durationSec: integer('duration_sec'), // voice/audio length
  replyToId: uuid('reply_to_id'), // self reference; kept FK-free to avoid circular definition
  isDeleted: boolean('is_deleted').notNull().default(false),
  isSystem:  boolean('is_system').notNull().default(false), // "X joined", "group created", ...
  editedAt:  timestamp('edited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Telegram-style saved contacts (one-directional: owner saved contact).
export const chatContacts = pgTable('chat_contacts', {
  id:            uuid('id').defaultRandom().primaryKey(),
  ownerUserId:   uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactUserId: uuid('contact_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  contactUnique: uniqueIndex('chat_contacts_owner_contact_uniq').on(t.ownerUserId, t.contactUserId),
}));

export type ChatRoom = typeof chatRooms.$inferSelect;
export type ChatMember = typeof chatMembers.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatContact = typeof chatContacts.$inferSelect;
