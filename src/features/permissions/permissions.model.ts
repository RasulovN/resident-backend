import { sql } from 'drizzle-orm';
import { boolean, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { permissionScopeEnum } from '../../db/enums';
import { roles } from '../roles/roles.model';

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // e.g. "users.create", "roles.read", "menu.{id}.view", "entity.{id}.create"
  key: text('key').notNull().unique(),
  description: text('description'),
  scope: permissionScopeEnum('scope').notNull().default('organization'),
  // dynamic permissions are auto-generated for menus/entities
  isDynamic: boolean('is_dynamic').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
);

export type Permission = typeof permissions.$inferSelect;
