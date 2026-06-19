import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { menuTypeEnum } from '../../db/enums';
import { organizations } from '../organizations/organizations.model';

export type MenuDisplayConfig = {
  defaultView?: 'table' | 'list' | 'card';
};

export const menus = pgTable('menus', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // null = platform menu
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  parentId: uuid('parent_id').references((): AnyPgColumn => menus.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon'),
  path: text('path'),
  type: menuTypeEnum('type').notNull().default('group'),
  // links to a dynamic entity definition when type = 'dynamic_entity'
  entityId: uuid('entity_id'),
  displayConfig: jsonb('display_config').$type<MenuDisplayConfig>().notNull().default({}),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Menu = typeof menus.$inferSelect;
export type NewMenu = typeof menus.$inferInsert;
