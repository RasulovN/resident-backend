import { and, count, eq, ilike, inArray, type SQL } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { organizations } from '../organizations/organizations.model';
import { permissions, rolePermissions } from '../permissions/permissions.model';
import { organizationMembers } from '../members/members.model';
import { memberRoles, roles } from './roles.model';

export type AdminRoleRow = {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date | null;
  permissionCount: number;
  memberCount: number;
};

/** Every role across all mahallas, with the owning org name + usage counts. */
export async function listAllRoles(filter: { organizationId?: string; search?: string }): Promise<AdminRoleRow[]> {
  const conds: SQL[] = [];
  if (filter.organizationId) conds.push(eq(roles.organizationId, filter.organizationId));
  if (filter.search) conds.push(ilike(roles.name, `%${filter.search}%`));

  const roleRows = await db
    .select({
      id: roles.id,
      organizationId: roles.organizationId,
      organizationName: organizations.name,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
    })
    .from(roles)
    .leftJoin(organizations, eq(organizations.id, roles.organizationId))
    .where(conds.length ? and(...conds) : undefined);

  const ids = roleRows.map((r) => r.id);
  const [permCounts, memberCounts] = await Promise.all([
    ids.length
      ? db.select({ roleId: rolePermissions.roleId, c: count() }).from(rolePermissions).where(inArray(rolePermissions.roleId, ids)).groupBy(rolePermissions.roleId)
      : Promise.resolve([] as { roleId: string; c: number }[]),
    ids.length
      ? db.select({ roleId: memberRoles.roleId, c: count() }).from(memberRoles).where(inArray(memberRoles.roleId, ids)).groupBy(memberRoles.roleId)
      : Promise.resolve([] as { roleId: string; c: number }[]),
  ]);
  const pMap = new Map(permCounts.map((r) => [r.roleId, Number(r.c)]));
  const mMap = new Map(memberCounts.map((r) => [r.roleId, Number(r.c)]));

  return roleRows
    .map((r) => ({
      ...r,
      isSystem: r.isSystem ?? false,
      permissionCount: pMap.get(r.id) ?? 0,
      memberCount: mMap.get(r.id) ?? 0,
    }))
    // Group visually by mahalla, then role name.
    .sort((a, b) =>
      (a.organizationName ?? '').localeCompare(b.organizationName ?? '') || a.name.localeCompare(b.name),
    );
}

/** Resolve the org a role belongs to (so org-scoped services can be reused). */
export async function getRoleOrgId(id: string): Promise<string> {
  const role = await db.query.roles.findFirst({ where: eq(roles.id, id) });
  if (!role || !role.organizationId) throw AppError.notFound('Role not found');
  return role.organizationId;
}

/** Org-scoped permission catalog used by the role permission picker. */
export async function listOrgPermissions() {
  return db
    .select({ id: permissions.id, key: permissions.key, description: permissions.description, isDynamic: permissions.isDynamic })
    .from(permissions)
    .where(eq(permissions.scope, 'organization'))
    .orderBy(permissions.key);
}

export async function getMemberOrg(memberId: string) {
  const m = await db.query.organizationMembers.findFirst({ where: eq(organizationMembers.id, memberId) });
  if (!m) throw AppError.notFound('Member not found');
  return m;
}

export async function getOrgOwnerId(organizationId: string): Promise<string | null> {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) });
  return org?.ownerUserId ?? null;
}
