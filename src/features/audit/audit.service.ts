import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { users } from '../users/users.model';
import { mobileProfiles } from '../mobile/mobile-auth.model';
import { auditLogs } from './audit.model';

type LogFilters = {
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  search?: string;
};

const actorName = sql<string>`nullif(trim(concat(
  coalesce(${mobileProfiles.firstName}, ${users.firstName}, ''), ' ',
  coalesce(${mobileProfiles.lastName}, ${users.lastName}, '')
)), '')`;

function dateConditions(from?: string, to?: string) {
  const c = [];
  if (from) c.push(gte(auditLogs.createdAt, new Date(from)));
  if (to) {
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    c.push(sql`${auditLogs.createdAt} <= ${t}`);
  }
  return c;
}

const selectShape = {
  id: auditLogs.id,
  actorId: auditLogs.userId,
  organizationId: auditLogs.organizationId,
  action: auditLogs.action,
  resource: auditLogs.resource,
  resourceId: auditLogs.resourceId,
  metadata: auditLogs.metadata,
  ip: auditLogs.ip,
  userAgent: auditLogs.userAgent,
  createdAt: auditLogs.createdAt,
  actorName,
  actorEmail: sql<string | null>`coalesce(${mobileProfiles.email}, ${users.email})`,
  actorAvatar: sql<string | null>`coalesce(${mobileProfiles.avatarUrl}, ${users.avatarUrl})`,
};

/** Logs scoped to one mahalla — actions tied to that org, for the admin panel. */
export async function listOrgLogs(organizationId: string, pagination: Pagination, filters: LogFilters) {
  const conditions = [eq(auditLogs.organizationId, organizationId)];
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  conditions.push(...dateConditions(filters.from, filters.to));
  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions.push(or(ilike(auditLogs.action, q), ilike(auditLogs.resource, q), ilike(users.email, q))!);
  }
  const where = and(...conditions);

  const rows = await db
    .select(selectShape)
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .leftJoin(mobileProfiles, eq(auditLogs.userId, mobileProfiles.userId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where);

  return paginated(rows, total, pagination);
}

/** A single user's own activity (used by the mobile "my activity" screen). */
export async function listUserLogs(userId: string, pagination: Pagination) {
  const where = eq(auditLogs.userId, userId);

  const rows = await db
    .select(selectShape)
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .leftJoin(mobileProfiles, eq(auditLogs.userId, mobileProfiles.userId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);

  return paginated(rows, total, pagination);
}

/** Distinct action names present for a mahalla — feeds the filter dropdown. */
export async function listOrgActions(organizationId: string) {
  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(auditLogs.action);
  return rows.map((r) => r.action);
}
