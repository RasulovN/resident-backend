import { and, between, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { auditLogs } from '../audit/audit.model';
import { organizations } from '../organizations/organizations.model';
import { users } from '../users/users.model';
import { subscriptionPlans } from '../subscriptions/subscriptions.model';

// Alias to avoid name clash inside left-join selects
const orgs = organizations;

export async function adminGetStats() {
  const [orgCount] = await db.select({ value: sql<number>`count(*)::int` }).from(organizations);
  const [userCount] = await db.select({ value: sql<number>`count(*)::int` }).from(users);
  const [activeSubCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(organizations)
    .where(eq(organizations.subscriptionStatus, 'active'));

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [newOrgsThisMonth] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(organizations)
    .where(gte(organizations.createdAt, firstOfMonth));

  const [newUsersThisMonth] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(users)
    .where(gte(users.createdAt, firstOfMonth));

  const recentOrgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status,
      subscriptionStatus: organizations.subscriptionStatus,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt))
    .limit(5);

  return {
    totalOrganizations: orgCount?.value ?? 0,
    totalUsers: userCount?.value ?? 0,
    activeSubscriptions: activeSubCount?.value ?? 0,
    newOrganizationsThisMonth: newOrgsThisMonth?.value ?? 0,
    newUsersThisMonth: newUsersThisMonth?.value ?? 0,
    recentOrganizations: recentOrgs,
  };
}

export async function adminGetAnalytics(months = 6) {
  const rows: Array<{ month: string; orgs: number; users: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const [orgC] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(organizations)
      .where(between(organizations.createdAt, from, to));

    const [userC] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(users)
      .where(between(users.createdAt, from, to));

    rows.push({
      month: from.toLocaleString('uz-UZ', { month: 'short', year: '2-digit' }),
      orgs: orgC?.value ?? 0,
      users: userC?.value ?? 0,
    });
  }

  const planBreakdown = await db
    .select({
      planName: subscriptionPlans.name,
      count: sql<number>`count(*)::int`,
    })
    .from(organizations)
    .leftJoin(subscriptionPlans, eq(organizations.subscriptionPlanId, subscriptionPlans.id))
    .groupBy(subscriptionPlans.name);

  const statusBreakdown = await db
    .select({
      status: organizations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(organizations)
    .groupBy(organizations.status);

  return { monthly: rows, planBreakdown, statusBreakdown };
}

export async function adminListAuditLogs(
  pagination: Pagination,
  filters: { action?: string; userId?: string; from?: string; to?: string; search?: string },
) {
  const conditions = [];

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.from) {
    conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    const to = new Date(filters.to);
    to.setHours(23, 59, 59, 999);
    conditions.push(sql`${auditLogs.createdAt} <= ${to}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rawRows = await db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.userId,
      organizationId: auditLogs.organizationId,
      action: auditLogs.action,
      resourceType: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      meta: auditLogs.metadata,
      ip: auditLogs.ip,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
      actorEmail: users.email,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
      orgName: orgs.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .leftJoin(orgs, eq(auditLogs.organizationId, orgs.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const rows = rawRows.map((r) => ({
    ...r,
    actorName: [r.actorFirstName, r.actorLastName].filter(Boolean).join(' ') || null,
    actorFirstName: undefined,
    actorLastName: undefined,
  }));

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function adminGetUserActivity(userId: string, pagination: Pagination) {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
      ip: auditLogs.ip,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
      organizationId: auditLogs.organizationId,
    })
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId));

  return paginated(rows, total, pagination);
}
