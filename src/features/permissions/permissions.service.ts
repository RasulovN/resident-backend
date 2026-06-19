import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { organizationMembers } from '../members/members.model';
import { memberRoles, roles } from '../roles/roles.model';
import { permissions, rolePermissions } from './permissions.model';

// Drizzle transaction type, extracted from the db.transaction callback signature.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Attaches a permission to the organization's system "Owner" role so that the
 * owner immediately gains access to newly created dynamic resources (menus,
 * entities). Idempotent.
 */
export async function grantPermissionToOwnerRole(
  tx: Tx,
  organizationId: string,
  permissionId: string,
): Promise<void> {
  const ownerRole = await tx.query.roles.findFirst({
    where: and(
      eq(roles.organizationId, organizationId),
      eq(roles.isSystem, true),
      eq(roles.name, 'Owner'),
    ),
    columns: { id: true },
  });
  if (!ownerRole) return;
  await tx
    .insert(rolePermissions)
    .values({ roleId: ownerRole.id, permissionId })
    .onConflictDoNothing();
}

export async function listPermissions(scope?: 'platform' | 'organization') {
  return db.query.permissions.findMany({
    where: scope ? eq(permissions.scope, scope) : undefined,
    orderBy: (p, { asc }) => asc(p.key),
  });
}

/**
 * Compute the set of permission keys a user effectively has within an organization.
 * Returns an empty set if the user is not an active member.
 */
export async function getEffectivePermissions(
  userId: string,
  organizationId: string,
): Promise<Set<string>> {
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, 'active'),
    ),
  });
  if (!member) return new Set();

  const roleRows = await db
    .select({ roleId: memberRoles.roleId })
    .from(memberRoles)
    .where(eq(memberRoles.memberId, member.id));

  const roleIds = roleRows.map((r) => r.roleId);
  if (roleIds.length === 0) return new Set();

  const permRows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(rolePermissions.roleId, roleIds));

  return new Set(permRows.map((p) => p.key));
}

export async function isOrganizationMember(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, 'active'),
    ),
  });
  return Boolean(member);
}
