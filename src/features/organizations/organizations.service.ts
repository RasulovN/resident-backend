import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { randomSuffix, slugify } from '../../common/utils/slug';
import { organizationMembers } from '../members/members.model';
import { permissions } from '../permissions/permissions.model';
import { memberRoles, roles } from '../roles/roles.model';
import { rolePermissions } from '../permissions/permissions.model';
import { users } from '../users/users.model';
import { organizations } from './organizations.model';
import type {
  AdminSetSubscriptionInput,
  AdminUpdateOrganizationInput,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from './organizations.schema';

const TRIAL_DAYS = 14;

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'org';
  let candidate = root;
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, candidate),
    });
    if (!existing) return candidate;
    candidate = `${root}-${randomSuffix(4)}`;
  }
  return `${root}-${randomSuffix(8)}`;
}

/**
 * Creates an organization owned by the user, makes them an active member, and
 * provisions a system "Owner" role holding every organization-scoped permission.
 */
export async function createOrganization(userId: string, input: CreateOrganizationInput) {
  const slug = await uniqueSlug(input.name);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const org = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(organizations)
      .values({
        name: input.name,
        slug,
        subdomain: input.subdomain,
        address: input.address,
        logoUrl: input.logoUrl,
        regionId: input.regionId,
        districtId: input.districtId,
        city: input.city,
        district: input.district,
        phone: input.phone,
        totalAreaSqm: input.totalAreaSqm,
        establishedAt: input.establishedAt ? new Date(input.establishedAt) : undefined,
        ownerUserId: userId,
        status: 'trial',
        subscriptionStatus: 'trial',
        trialEndsAt,
      })
      .returning();

    const [member] = await tx
      .insert(organizationMembers)
      .values({ organizationId: created!.id, userId, status: 'active' })
      .returning();

    const [ownerRole] = await tx
      .insert(roles)
      .values({
        organizationId: created!.id,
        name: 'Owner',
        description: 'Full access to the organization',
        isSystem: true,
      })
      .returning();

    const orgPerms = await tx.query.permissions.findMany({
      where: eq(permissions.scope, 'organization'),
    });
    if (orgPerms.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(orgPerms.map((p) => ({ roleId: ownerRole!.id, permissionId: p.id })));
    }

    await tx.insert(memberRoles).values({ memberId: member!.id, roleId: ownerRole!.id });

    return created!;
  });

  return org;
}

export async function listUserOrganizations(userId: string) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logoUrl: organizations.logoUrl,
      status: organizations.status,
      memberStatus: organizationMembers.status,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));
}

export async function getOrganization(id: string) {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, id) });
  if (!org) throw AppError.notFound('Organization not found');
  return org;
}

export async function updateOrganization(id: string, input: UpdateOrganizationInput) {
  const { establishedAt, latitude, longitude, ...rest } = input;
  const [updated] = await db
    .update(organizations)
    .set({
      ...rest,
      ...(latitude != null ? { latitude: String(latitude) } : {}),
      ...(longitude != null ? { longitude: String(longitude) } : {}),
      ...(establishedAt != null ? { establishedAt: new Date(establishedAt) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, id))
    .returning();
  if (!updated) throw AppError.notFound('Organization not found');
  return updated;
}

// ---- Platform admin ----

export async function adminListOrganizations(
  pagination: Pagination,
  filters?: { search?: string; regionId?: string; districtId?: string; status?: string },
) {
  const conditions = [];
  if (filters?.search) conditions.push(ilike(organizations.name, `%${filters.search}%`));
  if (filters?.regionId) conditions.push(eq(organizations.regionId, filters.regionId));
  if (filters?.districtId) conditions.push(eq(organizations.districtId, filters.districtId));
  if (filters?.status) conditions.push(eq(organizations.status, filters.status as 'active' | 'trial' | 'suspended'));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status,
      subscriptionStatus: organizations.subscriptionStatus,
      subscriptionPlanId: organizations.subscriptionPlanId,
      currentPeriodEnd: organizations.currentPeriodEnd,
      regionId: organizations.regionId,
      districtId: organizations.districtId,
      city: organizations.city,
      district: organizations.district,
      phone: organizations.phone,
      ownerEmail: users.email,
      ownerName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(users, eq(organizations.ownerUserId, users.id))
    .where(where)
    .orderBy(desc(organizations.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(organizations)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function adminUpdateOrganization(id: string, input: AdminUpdateOrganizationInput) {
  const { establishedAt, latitude, longitude, ...rest } = input as { establishedAt?: string | null; latitude?: number; longitude?: number } & Omit<AdminUpdateOrganizationInput, 'establishedAt' | 'latitude' | 'longitude'>;
  const [updated] = await db
    .update(organizations)
    .set({
      ...rest,
      ...(latitude != null ? { latitude: String(latitude) } : {}),
      ...(longitude != null ? { longitude: String(longitude) } : {}),
      ...(establishedAt != null ? { establishedAt: new Date(establishedAt) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, id))
    .returning();
  if (!updated) throw AppError.notFound('Organization not found');
  return updated;
}

export async function adminSetSubscription(id: string, input: AdminSetSubscriptionInput) {
  const org = await getOrganization(id);

  // If still within the current period, extend from period end; else start from now
  const now = new Date();
  const baseDate = org.currentPeriodEnd && org.currentPeriodEnd > now ? org.currentPeriodEnd : now;

  const newPeriodEnd = new Date(baseDate);
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + input.durationMonths);

  const [updated] = await db
    .update(organizations)
    .set({
      ...(input.planId !== undefined ? { subscriptionPlanId: input.planId } : {}),
      status: 'active',
      subscriptionStatus: 'active',
      currentPeriodEnd: newPeriodEnd,
      updatedAt: now,
    })
    .where(eq(organizations.id, id))
    .returning();
  if (!updated) throw AppError.notFound('Organization not found');
  return updated;
}

export async function adminApproveOrganization(id: string) {
  const [updated] = await db
    .update(organizations)
    .set({ status: 'active', subscriptionStatus: 'active', updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();
  if (!updated) throw AppError.notFound('Organization not found');
  return updated;
}

export async function adminDeleteOrganization(id: string) {
  const [deleted] = await db
    .delete(organizations)
    .where(eq(organizations.id, id))
    .returning({ id: organizations.id });
  if (!deleted) throw AppError.notFound('Organization not found');
}

// guard helper used by membership checks
export async function assertOrgExists(id: string) {
  const exists = await db.query.organizations.findFirst({
    where: and(eq(organizations.id, id)),
    columns: { id: true },
  });
  if (!exists) throw AppError.notFound('Organization not found');
}
