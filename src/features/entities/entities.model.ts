import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { entityFieldTypeEnum, recordStatusEnum } from '../../db/enums';
import { organizations } from '../organizations/organizations.model';
import { menus } from '../menus/menus.model';
import { users } from '../users/users.model';

export type EntityDisplayConfig = {
  views?: Array<'table' | 'list' | 'card'>;
  defaultView?: 'table' | 'list' | 'card';
  columns?: string[]; // field keys shown by default
};

export type EntityFieldConfig = {
  required?: boolean;
  unique?: boolean;
  min?: number;
  max?: number;
  default?: unknown;
  options?: Array<{ label: string; value: string }>; // select / multiselect
  relationEntityId?: string; // relation target
};

// a collection / "table" definition (e.g. Products, Categories)
export const entityDefinitions = pgTable(
  'entity_definitions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    menuId: uuid('menu_id').references(() => menus.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    displayConfig: jsonb('display_config').$type<EntityDisplayConfig>().notNull().default({
      views: ['table'],
      defaultView: 'table',
    }),
    supportsArchive: boolean('supports_archive').notNull().default(true),
    supportsStatus: boolean('supports_status').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueSlug: unique('uniq_org_entity_slug').on(t.organizationId, t.slug),
  }),
);

// field definition for an entity
export const entityFields = pgTable(
  'entity_fields',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    entityDefinitionId: uuid('entity_definition_id')
      .notNull()
      .references(() => entityDefinitions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    key: text('key').notNull(),
    type: entityFieldTypeEnum('type').notNull(),
    config: jsonb('config').$type<EntityFieldConfig>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    showInList: boolean('show_in_list').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueKey: unique('uniq_entity_field_key').on(t.entityDefinitionId, t.key),
  }),
);

// actual data rows (JSONB-based, no per-entity DDL)
export const entityRecords = pgTable(
  'entity_records',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    entityDefinitionId: uuid('entity_definition_id')
      .notNull()
      .references(() => entityDefinitions.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    status: recordStatusEnum('status').notNull().default('active'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    byEntityOrg: index('idx_records_entity_org').on(t.entityDefinitionId, t.organizationId),
    byData: index('idx_records_data').using('gin', t.data),
  }),
);

export type EntityDefinition = typeof entityDefinitions.$inferSelect;
export type EntityField = typeof entityFields.$inferSelect;
export type EntityRecord = typeof entityRecords.$inferSelect;
