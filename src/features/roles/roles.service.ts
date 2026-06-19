import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { permissions, rolePermissions } from '../permissions/permissions.model';
import { roles } from './roles.model';
import type { CreateRoleInput, UpdateRoleInput } from './roles.schema';

// Only organization-scoped permissions may be attached to org roles.
async function assertOrgPermissions(permissionIds: string[]) {
  if (permissionIds.length === 0) return;
  const found = await db.query.permissions.findMany({
    where: and(inArray(permissions.id, permissionIds), eq(permissions.scope, 'organization')),
    columns: { id: true },
  });
  if (found.length !== permissionIds.length) {
    throw AppError.badRequest('Invalid permission ids for organization scope');
  }
}

async function loadPermissionIds(roleId: string): Promise<string[]> {
  const rows = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((r) => r.permissionId);
}

export async function listRoles(organizationId: string) {
  const orgRoles = await db.query.roles.findMany({
    where: eq(roles.organizationId, organizationId),
    orderBy: (r, { asc }) => asc(r.createdAt),
  });

  const ids = orgRoles.map((r) => r.id);
  const permRows = ids.length
    ? await db
        .select({ roleId: rolePermissions.roleId, permissionId: rolePermissions.permissionId })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, ids))
    : [];

  return orgRoles.map((r) => ({
    ...r,
    permissionIds: permRows.filter((p) => p.roleId === r.id).map((p) => p.permissionId),
  }));
}

export async function getRole(organizationId: string, id: string) {
  const role = await db.query.roles.findFirst({
    where: and(eq(roles.id, id), eq(roles.organizationId, organizationId)),
  });
  if (!role) throw AppError.notFound('Role not found');
  return { ...role, permissionIds: await loadPermissionIds(role.id) };
}

export async function createRole(organizationId: string, input: CreateRoleInput) {
  await assertOrgPermissions(input.permissionIds);

  return db.transaction(async (tx) => {
    const [role] = await tx
      .insert(roles)
      .values({ organizationId, name: input.name, description: input.description })
      .returning();
    if (input.permissionIds.length) {
      await tx
        .insert(rolePermissions)
        .values(input.permissionIds.map((permissionId) => ({ roleId: role!.id, permissionId })));
    }
    return { ...role!, permissionIds: input.permissionIds };
  });
}

export async function updateRole(organizationId: string, id: string, input: UpdateRoleInput) {
  const role = await db.query.roles.findFirst({
    where: and(eq(roles.id, id), eq(roles.organizationId, organizationId)),
  });
  if (!role) throw AppError.notFound('Role not found');
  if (role.isSystem) throw AppError.badRequest('System roles cannot be modified');

  if (input.permissionIds) await assertOrgPermissions(input.permissionIds);

  await db.transaction(async (tx) => {
    if (input.name !== undefined || input.description !== undefined) {
      await tx
        .update(roles)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          updatedAt: new Date(),
        })
        .where(eq(roles.id, id));
    }
    if (input.permissionIds) {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      if (input.permissionIds.length) {
        await tx
          .insert(rolePermissions)
          .values(input.permissionIds.map((permissionId) => ({ roleId: id, permissionId })));
      }
    }
  });

  return getRole(organizationId, id);
}

export async function deleteRole(organizationId: string, id: string) {
  const role = await db.query.roles.findFirst({
    where: and(eq(roles.id, id), eq(roles.organizationId, organizationId)),
  });
  if (!role) throw AppError.notFound('Role not found');
  if (role.isSystem) throw AppError.badRequest('System roles cannot be deleted');
  await db.delete(roles).where(eq(roles.id, id));
}
