import { and, desc, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { users } from '../users/users.model';
import { organizationMembers } from '../members/members.model';
import { mobileProfiles } from '../mobile/mobile-auth.model';
import { createNotification, sendNotification } from '../notifications/notifications.service';
import {
  inquiries,
  inquiryEvents,
  type Inquiry,
  type InquiryAttachment,
  type NewInquiryEvent,
} from './inquiries.model';
import type {
  CreateInquiryInput,
  UpdateStatusInput,
  AddCommentInput,
  ExtendDeadlineInput,
  EscalateInput,
  UpdateInquiryInput,
  RateInput,
  InquiryListQuery,
  ResidentListQuery,
} from './inquiries.schema';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Default legal review window for citizen appeals (15 calendar days). */
const DEFAULT_DEADLINE_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABEL_UZ: Record<string, string> = {
  NEW: 'Yangi',
  IN_PROGRESS: 'Ko‘rib chiqilmoqda',
  NEEDS_INFO: 'Qo‘shimcha ma’lumot kerak',
  ESCALATED: 'Yuqori organga yo‘naltirildi',
  RESOLVED: 'Hal qilindi',
  REJECTED: 'Rad etildi',
  CLOSED: 'Yopildi',
};

const TERMINAL_STATUSES = ['RESOLVED', 'REJECTED', 'CLOSED'] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Resident display name, preferring the mobile profile then the user record. */
const residentNameSql = sql<string>`nullif(trim(concat(
  coalesce(${mobileProfiles.firstName}, ${users.firstName}, ''), ' ',
  coalesce(${mobileProfiles.lastName}, ${users.lastName}, '')
)), '')`;

async function generateTicketNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(
      and(
        eq(inquiries.organizationId, organizationId),
        sql`extract(year from ${inquiries.createdAt}) = ${year}`,
      ),
    );
  const seq = String((total ?? 0) + 1).padStart(6, '0');
  return `M-${year}-${seq}`;
}

async function recordEvent(event: NewInquiryEvent): Promise<void> {
  await db.insert(inquiryEvents).values(event);
  await db
    .update(inquiries)
    .set({ lastEventAt: new Date(), updatedAt: new Date() })
    .where(eq(inquiries.id, event.inquiryId));
}

/** Create + immediately send a notification to specific resident users. */
async function notifyUsers(
  organizationId: string,
  userIds: string[],
  payload: { title: string; body: string; deepLink: string },
  createdById: string,
): Promise<void> {
  const targets = userIds.filter(Boolean);
  if (targets.length === 0) return;
  try {
    const notif = await createNotification(
      {
        title: payload.title,
        body: payload.body,
        type: 'MUROJAAT',
        channel: 'MAHALLA',
        targetType: 'SPECIFIC_USERS',
        targetUserIds: targets,
        deepLink: payload.deepLink,
      },
      createdById,
      organizationId,
    );
    await sendNotification(notif.id);
  } catch {
    // Notification delivery is best-effort — never block the inquiry workflow.
  }
}

/** Notify the applicant about a public change on their inquiry. */
async function notifyResident(
  inquiry: Pick<Inquiry, 'id' | 'organizationId' | 'residentId' | 'isAnonymous' | 'ticketNumber'>,
  payload: { title: string; body: string },
  actorId: string | null,
): Promise<void> {
  if (!inquiry.residentId) return;
  await notifyUsers(
    inquiry.organizationId,
    [inquiry.residentId],
    { ...payload, deepLink: `/murojaat/${inquiry.id}` },
    actorId ?? inquiry.residentId,
  );
}

async function loadInquiry(organizationId: string, id: string): Promise<Inquiry> {
  const row = await db.query.inquiries.findFirst({
    where: and(eq(inquiries.id, id), eq(inquiries.organizationId, organizationId)),
  });
  if (!row) throw AppError.notFound('Inquiry not found');
  return row;
}

// ─── Create ─────────────────────────────────────────────────────────────────────

export async function createInquiry(
  organizationId: string,
  residentId: string | null,
  input: CreateInquiryInput,
): Promise<Inquiry> {
  const ticketNumber = await generateTicketNumber(organizationId);
  const dueAt = new Date(Date.now() + DEFAULT_DEADLINE_DAYS * DAY_MS);

  const [created] = await db
    .insert(inquiries)
    .values({
      organizationId,
      residentId,
      ticketNumber,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      location: input.location,
      contactPhone: input.contactPhone,
      isAnonymous: input.isAnonymous,
      attachments: input.attachments as InquiryAttachment[],
      deadlineDays: DEFAULT_DEADLINE_DAYS,
      dueAt,
    })
    .returning();

  const inquiry = created!;

  await recordEvent({
    inquiryId: inquiry.id,
    type: 'CREATED',
    authorId: residentId,
    authorRole: residentId ? 'resident' : 'staff',
    body: input.description,
    toStatus: 'NEW',
    isInternal: false,
    attachments: input.attachments as InquiryAttachment[],
  });

  // Notify mahalla staff that a new appeal arrived.
  try {
    const notif = await createNotification(
      {
        title: 'Yangi murojaat',
        body: `${ticketNumber}: ${input.title}`,
        type: 'MUROJAAT',
        channel: 'MAHALLA',
        targetType: 'ADMINS',
        targetUserIds: [],
        deepLink: `/inquiries/${inquiry.id}`,
      },
      residentId ?? inquiry.id,
      organizationId,
    );
    await sendNotification(notif.id);
  } catch {
    /* best-effort */
  }

  return inquiry;
}

// ─── Read (staff) ────────────────────────────────────────────────────────────────

export async function listInquiries(organizationId: string, query: InquiryListQuery) {
  const pagination: Pagination = { page: query.page, limit: query.limit };
  const conditions = [eq(inquiries.organizationId, organizationId)];

  if (query.status) conditions.push(eq(inquiries.status, query.status));
  if (query.category) conditions.push(eq(inquiries.category, query.category));
  if (query.priority) conditions.push(eq(inquiries.priority, query.priority));
  if (query.assignedToId) conditions.push(eq(inquiries.assignedToId, query.assignedToId));
  if (query.escalated !== undefined) conditions.push(eq(inquiries.escalated, query.escalated));
  if (query.overdue) {
    conditions.push(sql`${inquiries.dueAt} < now()`);
    conditions.push(sql`${inquiries.status} not in ('RESOLVED','REJECTED','CLOSED')`);
  }
  if (query.search) {
    const q = `%${query.search}%`;
    conditions.push(
      or(
        ilike(inquiries.title, q),
        ilike(inquiries.description, q),
        ilike(inquiries.ticketNumber, q),
      )!,
    );
  }

  const where = and(...conditions);

  const assignee = db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .as('assignee');

  const orderBy = (() => {
    switch (query.sort) {
      case 'oldest':
        return [asc(inquiries.createdAt)];
      case 'due':
        return [asc(inquiries.dueAt)];
      case 'priority':
        return [
          sql`case ${inquiries.priority} when 'URGENT' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end`,
          desc(inquiries.lastEventAt),
        ];
      default:
        return [desc(inquiries.lastEventAt)];
    }
  })();

  const rows = await db
    .select({
      id: inquiries.id,
      ticketNumber: inquiries.ticketNumber,
      title: inquiries.title,
      category: inquiries.category,
      priority: inquiries.priority,
      status: inquiries.status,
      isAnonymous: inquiries.isAnonymous,
      attachmentCount: sql<number>`coalesce(jsonb_array_length(${inquiries.attachments}), 0)::int`,
      dueAt: inquiries.dueAt,
      escalated: inquiries.escalated,
      extensionCount: inquiries.extensionCount,
      assignedToId: inquiries.assignedToId,
      assigneeName: sql<string>`nullif(trim(concat(coalesce(${assignee.firstName}, ''), ' ', coalesce(${assignee.lastName}, ''))), '')`,
      residentId: inquiries.residentId,
      residentName: residentNameSql,
      createdAt: inquiries.createdAt,
      lastEventAt: inquiries.lastEventAt,
      isOverdue: sql<boolean>`(${inquiries.dueAt} < now() and ${inquiries.status} not in ('RESOLVED','REJECTED','CLOSED'))`,
    })
    .from(inquiries)
    .leftJoin(users, eq(inquiries.residentId, users.id))
    .leftJoin(mobileProfiles, eq(inquiries.residentId, mobileProfiles.userId))
    .leftJoin(assignee, eq(inquiries.assignedToId, assignee.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(where);

  // Anonymise applicant identity in the list view.
  const items = rows.map((r) => ({
    ...r,
    residentId: r.isAnonymous ? null : r.residentId,
    residentName: r.isAnonymous ? null : r.residentName,
  }));

  return paginated(items, total, pagination);
}

async function loadEvents(inquiryId: string, includeInternal: boolean) {
  const conditions = [eq(inquiryEvents.inquiryId, inquiryId)];
  if (!includeInternal) conditions.push(eq(inquiryEvents.isInternal, false));

  const author = users;
  const authorProfile = mobileProfiles;

  return db
    .select({
      id: inquiryEvents.id,
      type: inquiryEvents.type,
      body: inquiryEvents.body,
      fromStatus: inquiryEvents.fromStatus,
      toStatus: inquiryEvents.toStatus,
      isInternal: inquiryEvents.isInternal,
      attachments: inquiryEvents.attachments,
      authorId: inquiryEvents.authorId,
      authorRole: inquiryEvents.authorRole,
      authorName: sql<string>`nullif(trim(concat(
        coalesce(${authorProfile.firstName}, ${author.firstName}, ''), ' ',
        coalesce(${authorProfile.lastName}, ${author.lastName}, '')
      )), '')`,
      authorAvatar: sql<string | null>`coalesce(${authorProfile.avatarUrl}, ${author.avatarUrl})`,
      createdAt: inquiryEvents.createdAt,
    })
    .from(inquiryEvents)
    .leftJoin(author, eq(inquiryEvents.authorId, author.id))
    .leftJoin(authorProfile, eq(inquiryEvents.authorId, authorProfile.userId))
    .where(and(...conditions))
    .orderBy(asc(inquiryEvents.createdAt));
}

export async function getInquiry(organizationId: string, id: string) {
  const inquiry = await loadInquiry(organizationId, id);

  const [resident] = inquiry.residentId
    ? await db
        .select({
          id: users.id,
          name: residentNameSql,
          email: sql<string | null>`coalesce(${mobileProfiles.email}, ${users.email})`,
          phone: sql<string | null>`coalesce(${mobileProfiles.phone}, ${users.phone})`,
          avatarUrl: sql<string | null>`coalesce(${mobileProfiles.avatarUrl}, ${users.avatarUrl})`,
        })
        .from(users)
        .leftJoin(mobileProfiles, eq(mobileProfiles.userId, users.id))
        .where(eq(users.id, inquiry.residentId))
    : [undefined];

  const [assignee] = inquiry.assignedToId
    ? await db
        .select({
          id: users.id,
          name: sql<string>`trim(concat(${users.firstName}, ' ', ${users.lastName}))`,
        })
        .from(users)
        .where(eq(users.id, inquiry.assignedToId))
    : [undefined];

  const events = await loadEvents(id, true);

  return {
    ...inquiry,
    isOverdue:
      inquiry.dueAt < new Date() &&
      !TERMINAL_STATUSES.includes(inquiry.status as (typeof TERMINAL_STATUSES)[number]),
    resident: inquiry.isAnonymous ? null : resident ?? null,
    assignee: assignee ?? null,
    events,
  };
}

// ─── Read (resident, mobile) ──────────────────────────────────────────────────────

export async function listResidentInquiries(residentId: string, query: ResidentListQuery) {
  const pagination: Pagination = { page: query.page, limit: query.limit };
  const conditions = [eq(inquiries.residentId, residentId)];
  if (query.status) conditions.push(eq(inquiries.status, query.status));
  const where = and(...conditions);

  const rows = await db
    .select({
      id: inquiries.id,
      ticketNumber: inquiries.ticketNumber,
      title: inquiries.title,
      category: inquiries.category,
      priority: inquiries.priority,
      status: inquiries.status,
      dueAt: inquiries.dueAt,
      extensionCount: inquiries.extensionCount,
      attachmentCount: sql<number>`coalesce(jsonb_array_length(${inquiries.attachments}), 0)::int`,
      createdAt: inquiries.createdAt,
      lastEventAt: inquiries.lastEventAt,
      isOverdue: sql<boolean>`(${inquiries.dueAt} < now() and ${inquiries.status} not in ('RESOLVED','REJECTED','CLOSED'))`,
    })
    .from(inquiries)
    .where(where)
    .orderBy(desc(inquiries.lastEventAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function getResidentInquiry(residentId: string, id: string) {
  const inquiry = await db.query.inquiries.findFirst({
    where: and(eq(inquiries.id, id), eq(inquiries.residentId, residentId)),
  });
  if (!inquiry) throw AppError.notFound('Inquiry not found');

  const events = await loadEvents(id, false);

  return {
    ...inquiry,
    isOverdue:
      inquiry.dueAt < new Date() &&
      !TERMINAL_STATUSES.includes(inquiry.status as (typeof TERMINAL_STATUSES)[number]),
    events,
  };
}

// ─── Mutations (staff) ────────────────────────────────────────────────────────────

export async function updateInquiry(
  organizationId: string,
  id: string,
  input: UpdateInquiryInput,
): Promise<Inquiry> {
  const [updated] = await db
    .update(inquiries)
    .set({
      ...(input.category !== undefined && { category: input.category }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.location !== undefined && { location: input.location }),
      updatedAt: new Date(),
    })
    .where(and(eq(inquiries.id, id), eq(inquiries.organizationId, organizationId)))
    .returning();
  if (!updated) throw AppError.notFound('Inquiry not found');
  return updated;
}

export async function updateStatus(
  organizationId: string,
  id: string,
  actorId: string,
  input: UpdateStatusInput,
): Promise<Inquiry> {
  const current = await loadInquiry(organizationId, id);
  if (current.status === input.status && !input.comment && !input.resolution) {
    return current;
  }

  const now = new Date();
  const patch: Partial<typeof inquiries.$inferInsert> = {
    status: input.status,
    updatedAt: now,
  };

  if (input.status === 'RESOLVED') {
    patch.resolvedAt = now;
    patch.resolvedById = actorId;
    if (input.resolution) patch.resolution = input.resolution;
  }
  if (input.status === 'CLOSED') patch.closedAt = now;
  if (input.status === 'ESCALATED') patch.escalated = true;

  const [updated] = await db
    .update(inquiries)
    .set(patch)
    .where(and(eq(inquiries.id, id), eq(inquiries.organizationId, organizationId)))
    .returning();

  const bodyParts = [input.resolution, input.comment].filter(Boolean) as string[];

  await recordEvent({
    inquiryId: id,
    type: input.status === 'RESOLVED' ? 'RESOLVED' : 'STATUS_CHANGED',
    authorId: actorId,
    authorRole: 'staff',
    body: bodyParts.join('\n\n') || null,
    fromStatus: current.status,
    toStatus: input.status,
    isInternal: false,
  });

  await notifyResident(
    current,
    {
      title: `Murojaat holati: ${STATUS_LABEL_UZ[input.status] ?? input.status}`,
      body:
        input.status === 'RESOLVED' && input.resolution
          ? input.resolution
          : input.comment ||
            `${current.ticketNumber} murojaatingiz holati "${STATUS_LABEL_UZ[input.status] ?? input.status}" ga o‘zgartirildi.`,
    },
    actorId,
  );

  return updated!;
}

export async function addComment(
  organizationId: string,
  id: string,
  actorId: string,
  authorRole: 'staff' | 'resident',
  input: AddCommentInput,
): Promise<void> {
  const inquiry = await loadInquiry(organizationId, id);

  await recordEvent({
    inquiryId: id,
    type: 'COMMENT',
    authorId: actorId,
    authorRole,
    body: input.body,
    isInternal: input.isInternal,
    attachments: input.attachments as InquiryAttachment[],
  });

  // Only public staff comments notify the resident.
  if (authorRole === 'staff' && !input.isInternal) {
    await notifyResident(
      inquiry,
      {
        title: `Murojaatingizga javob — ${inquiry.ticketNumber}`,
        body: input.body.slice(0, 160),
      },
      actorId,
    );
  }
}

export async function assignInquiry(
  organizationId: string,
  id: string,
  actorId: string,
  assignedToId: string | null,
): Promise<Inquiry> {
  const current = await loadInquiry(organizationId, id);

  const patch: Partial<typeof inquiries.$inferInsert> = {
    assignedToId,
    assignedAt: assignedToId ? new Date() : null,
    updatedAt: new Date(),
  };
  // Picking up a brand-new case moves it into progress.
  if (assignedToId && current.status === 'NEW') patch.status = 'IN_PROGRESS';

  const [updated] = await db
    .update(inquiries)
    .set(patch)
    .where(and(eq(inquiries.id, id), eq(inquiries.organizationId, organizationId)))
    .returning();

  let assigneeName: string | null = null;
  if (assignedToId) {
    const [a] = await db
      .select({ name: sql<string>`trim(concat(${users.firstName}, ' ', ${users.lastName}))` })
      .from(users)
      .where(eq(users.id, assignedToId));
    assigneeName = a?.name ?? null;
  }

  await recordEvent({
    inquiryId: id,
    type: 'ASSIGNED',
    authorId: actorId,
    authorRole: 'staff',
    body: assignedToId ? `Mas'ul tayinlandi: ${assigneeName ?? ''}`.trim() : 'Mas’ul olib tashlandi',
    isInternal: true,
  });

  return updated!;
}

export async function extendDeadline(
  organizationId: string,
  id: string,
  actorId: string,
  input: ExtendDeadlineInput,
): Promise<Inquiry> {
  const current = await loadInquiry(organizationId, id);

  const newDeadlineDays = current.deadlineDays + input.additionalDays;
  const newDueAt = new Date(current.createdAt.getTime() + newDeadlineDays * DAY_MS);

  const [updated] = await db
    .update(inquiries)
    .set({
      deadlineDays: newDeadlineDays,
      dueAt: newDueAt,
      extensionCount: current.extensionCount + 1,
      lastExtensionReason: input.reason,
      updatedAt: new Date(),
    })
    .where(and(eq(inquiries.id, id), eq(inquiries.organizationId, organizationId)))
    .returning();

  await recordEvent({
    inquiryId: id,
    type: 'DEADLINE_EXTENDED',
    authorId: actorId,
    authorRole: 'staff',
    body: input.reason,
    isInternal: false,
  });

  const dueStr = newDueAt.toLocaleDateString('uz-UZ');
  await notifyResident(
    current,
    {
      title: 'Murojaat javobi muddati uzaytirildi',
      body: `Sizning ${current.ticketNumber} murojaatingiz javobi quyidagi sabablarga ko‘ra kechikmoqda: ${input.reason}. Yangi muddat: ${dueStr}.`,
    },
    actorId,
  );

  return updated!;
}

export async function escalateInquiry(
  organizationId: string,
  id: string,
  actorId: string,
  input: EscalateInput,
): Promise<Inquiry> {
  const current = await loadInquiry(organizationId, id);

  const [updated] = await db
    .update(inquiries)
    .set({
      escalated: true,
      escalatedAt: new Date(),
      escalatedById: actorId,
      escalationReason: input.reason,
      status: 'ESCALATED',
      updatedAt: new Date(),
    })
    .where(and(eq(inquiries.id, id), eq(inquiries.organizationId, organizationId)))
    .returning();

  await recordEvent({
    inquiryId: id,
    type: 'ESCALATED',
    authorId: actorId,
    authorRole: 'staff',
    body: input.reason,
    fromStatus: current.status,
    toStatus: 'ESCALATED',
    isInternal: false,
  });

  await notifyResident(
    current,
    {
      title: 'Murojaat yuqori organga yo‘naltirildi',
      body: `Sizning ${current.ticketNumber} murojaatingiz ko‘rib chiqish uchun yuqori organga yo‘naltirildi.`,
    },
    actorId,
  );

  return updated!;
}

// ─── Mutations (resident) ─────────────────────────────────────────────────────────

export async function addResidentComment(
  residentId: string,
  id: string,
  input: AddCommentInput,
): Promise<void> {
  const inquiry = await db.query.inquiries.findFirst({
    where: and(eq(inquiries.id, id), eq(inquiries.residentId, residentId)),
  });
  if (!inquiry) throw AppError.notFound('Inquiry not found');

  await recordEvent({
    inquiryId: id,
    type: 'COMMENT',
    authorId: residentId,
    authorRole: 'resident',
    body: input.body,
    isInternal: false,
    attachments: input.attachments as InquiryAttachment[],
  });

  // Nudge the responsible staff member (or org admins) that the applicant replied.
  const adminTargets = inquiry.assignedToId ? [inquiry.assignedToId] : [];
  if (adminTargets.length) {
    await notifyUsers(
      inquiry.organizationId,
      adminTargets,
      {
        title: `Fuqaro javob yozdi — ${inquiry.ticketNumber}`,
        body: input.body.slice(0, 160),
        deepLink: `/inquiries/${inquiry.id}`,
      },
      residentId,
    );
  }
}

export async function rateInquiry(residentId: string, id: string, input: RateInput): Promise<Inquiry> {
  const inquiry = await db.query.inquiries.findFirst({
    where: and(eq(inquiries.id, id), eq(inquiries.residentId, residentId)),
  });
  if (!inquiry) throw AppError.notFound('Inquiry not found');
  if (!TERMINAL_STATUSES.includes(inquiry.status as (typeof TERMINAL_STATUSES)[number])) {
    throw AppError.badRequest('Faqat hal qilingan murojaatni baholash mumkin');
  }

  const [updated] = await db
    .update(inquiries)
    .set({ rating: input.rating, ratingComment: input.comment, updatedAt: new Date() })
    .where(eq(inquiries.id, id))
    .returning();

  await recordEvent({
    inquiryId: id,
    type: 'RATED',
    authorId: residentId,
    authorRole: 'resident',
    body: input.comment || `Baho: ${input.rating}/5`,
    isInternal: false,
  });

  return updated!;
}

// ─── Statistics ────────────────────────────────────────────────────────────────

export async function getStats(organizationId: string) {
  const orgWhere = eq(inquiries.organizationId, organizationId);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      new: sql<number>`count(*) filter (where status = 'NEW')::int`,
      inProgress: sql<number>`count(*) filter (where status = 'IN_PROGRESS')::int`,
      needsInfo: sql<number>`count(*) filter (where status = 'NEEDS_INFO')::int`,
      escalated: sql<number>`count(*) filter (where status = 'ESCALATED')::int`,
      resolved: sql<number>`count(*) filter (where status = 'RESOLVED')::int`,
      rejected: sql<number>`count(*) filter (where status = 'REJECTED')::int`,
      closed: sql<number>`count(*) filter (where status = 'CLOSED')::int`,
      overdue: sql<number>`count(*) filter (where due_at < now() and status not in ('RESOLVED','REJECTED','CLOSED'))::int`,
      dueSoon: sql<number>`count(*) filter (where due_at >= now() and due_at < now() + interval '3 days' and status not in ('RESOLVED','REJECTED','CLOSED'))::int`,
      unassigned: sql<number>`count(*) filter (where assigned_to_id is null and status not in ('RESOLVED','REJECTED','CLOSED'))::int`,
      newThisMonth: sql<number>`count(*) filter (where created_at >= date_trunc('month', now()))::int`,
      resolvedThisMonth: sql<number>`count(*) filter (where resolved_at >= date_trunc('month', now()))::int`,
      avgRating: sql<number | null>`avg(rating)`,
      avgResolutionDays: sql<number | null>`avg(extract(epoch from (resolved_at - created_at)) / 86400.0) filter (where resolved_at is not null)`,
      onTimeResolved: sql<number>`count(*) filter (where resolved_at is not null and resolved_at <= due_at)::int`,
    })
    .from(inquiries)
    .where(orgWhere);

  const byCategory = await db
    .select({
      category: inquiries.category,
      count: sql<number>`count(*)::int`,
    })
    .from(inquiries)
    .where(orgWhere)
    .groupBy(inquiries.category);

  const byPriority = await db
    .select({
      priority: inquiries.priority,
      count: sql<number>`count(*)::int`,
    })
    .from(inquiries)
    .where(orgWhere)
    .groupBy(inquiries.priority);

  const monthly = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${inquiries.createdAt}), 'YYYY-MM')`,
      created: sql<number>`count(*)::int`,
      resolved: sql<number>`count(*) filter (where ${inquiries.status} in ('RESOLVED','CLOSED'))::int`,
    })
    .from(inquiries)
    .where(and(orgWhere, sql`${inquiries.createdAt} >= now() - interval '6 months'`))
    .groupBy(sql`date_trunc('month', ${inquiries.createdAt})`)
    .orderBy(sql`date_trunc('month', ${inquiries.createdAt})`);

  return {
    ...counts,
    avgRating: counts?.avgRating != null ? Number(counts.avgRating) : null,
    avgResolutionDays:
      counts?.avgResolutionDays != null ? Math.round(Number(counts.avgResolutionDays) * 10) / 10 : null,
    byCategory,
    byPriority,
    monthly,
  };
}

/**
 * Date-range filtered report for the Statistika page + Excel export.
 * All aggregates are filtered by `created_at` within [from, to]; the time series
 * is bucketed by the requested period (day/week/month).
 */
export async function getReport(
  organizationId: string,
  opts: { from?: Date; to?: Date; period?: 'day' | 'week' | 'month' },
) {
  const period = opts.period ?? 'month';
  const conds = [eq(inquiries.organizationId, organizationId)];
  if (opts.from) conds.push(sql`${inquiries.createdAt} >= ${opts.from.toISOString()}`);
  if (opts.to) conds.push(sql`${inquiries.createdAt} <= ${opts.to.toISOString()}`);
  const where = and(...conds);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      new: sql<number>`count(*) filter (where status = 'NEW')::int`,
      inProgress: sql<number>`count(*) filter (where status = 'IN_PROGRESS')::int`,
      needsInfo: sql<number>`count(*) filter (where status = 'NEEDS_INFO')::int`,
      escalated: sql<number>`count(*) filter (where status = 'ESCALATED')::int`,
      resolved: sql<number>`count(*) filter (where status = 'RESOLVED')::int`,
      rejected: sql<number>`count(*) filter (where status = 'REJECTED')::int`,
      closed: sql<number>`count(*) filter (where status = 'CLOSED')::int`,
      overdue: sql<number>`count(*) filter (where due_at < now() and status not in ('RESOLVED','REJECTED','CLOSED'))::int`,
      avgRating: sql<number | null>`avg(rating)`,
      avgResolutionDays: sql<number | null>`avg(extract(epoch from (resolved_at - created_at)) / 86400.0) filter (where resolved_at is not null)`,
      onTimeResolved: sql<number>`count(*) filter (where resolved_at is not null and resolved_at <= due_at)::int`,
      totalResolved: sql<number>`count(*) filter (where resolved_at is not null)::int`,
    })
    .from(inquiries)
    .where(where);

  const byCategory = await db
    .select({ category: inquiries.category, count: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(where)
    .groupBy(inquiries.category);

  const byPriority = await db
    .select({ priority: inquiries.priority, count: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(where)
    .groupBy(inquiries.priority);

  const byStatus = await db
    .select({ status: inquiries.status, count: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(where)
    .groupBy(inquiries.status);

  // `period` is a validated enum ('day'|'week'|'month'); inline it as a raw
  // literal so the date_trunc expression is byte-identical in SELECT/GROUP BY/
  // ORDER BY (a bound param would create distinct placeholders → GROUP BY error).
  const periodLit = sql.raw(`'${period}'`);
  const series = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${periodLit}, ${inquiries.createdAt}), 'YYYY-MM-DD')`,
      created: sql<number>`count(*)::int`,
      resolved: sql<number>`count(*) filter (where ${inquiries.status} in ('RESOLVED','CLOSED'))::int`,
    })
    .from(inquiries)
    .where(where)
    .groupBy(sql`date_trunc(${periodLit}, ${inquiries.createdAt})`)
    .orderBy(sql`date_trunc(${periodLit}, ${inquiries.createdAt})`);

  const onTimeRate =
    counts && counts.totalResolved > 0
      ? Math.round((counts.onTimeResolved / counts.totalResolved) * 100)
      : null;

  return {
    period,
    from: opts.from?.toISOString() ?? null,
    to: opts.to?.toISOString() ?? null,
    ...counts,
    avgRating: counts?.avgRating != null ? Math.round(Number(counts.avgRating) * 10) / 10 : null,
    avgResolutionDays:
      counts?.avgResolutionDays != null ? Math.round(Number(counts.avgResolutionDays) * 10) / 10 : null,
    onTimeRate,
    byStatus,
    byCategory,
    byPriority,
    series,
  };
}

/** Flat rows for Excel export (no pagination, capped). */
export async function listForExport(
  organizationId: string,
  filters: {
    from?: Date;
    to?: Date;
    status?: Inquiry['status'];
    category?: Inquiry['category'];
    priority?: Inquiry['priority'];
  },
) {
  const conds = [eq(inquiries.organizationId, organizationId)];
  if (filters.from) conds.push(sql`${inquiries.createdAt} >= ${filters.from.toISOString()}`);
  if (filters.to) conds.push(sql`${inquiries.createdAt} <= ${filters.to.toISOString()}`);
  if (filters.status) conds.push(eq(inquiries.status, filters.status));
  if (filters.category) conds.push(eq(inquiries.category, filters.category));
  if (filters.priority) conds.push(eq(inquiries.priority, filters.priority));

  const assignee = db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .as('assignee_exp');

  return db
    .select({
      ticketNumber: inquiries.ticketNumber,
      title: inquiries.title,
      description: inquiries.description,
      category: inquiries.category,
      priority: inquiries.priority,
      status: inquiries.status,
      isAnonymous: inquiries.isAnonymous,
      residentName: residentNameSql,
      contactPhone: inquiries.contactPhone,
      location: inquiries.location,
      assigneeName: sql<string>`nullif(trim(concat(coalesce(${assignee.firstName}, ''), ' ', coalesce(${assignee.lastName}, ''))), '')`,
      deadlineDays: inquiries.deadlineDays,
      extensionCount: inquiries.extensionCount,
      escalated: inquiries.escalated,
      rating: inquiries.rating,
      createdAt: inquiries.createdAt,
      dueAt: inquiries.dueAt,
      resolvedAt: inquiries.resolvedAt,
      isOverdue: sql<boolean>`(${inquiries.dueAt} < now() and ${inquiries.status} not in ('RESOLVED','REJECTED','CLOSED'))`,
    })
    .from(inquiries)
    .leftJoin(users, eq(inquiries.residentId, users.id))
    .leftJoin(mobileProfiles, eq(inquiries.residentId, mobileProfiles.userId))
    .leftJoin(assignee, eq(inquiries.assignedToId, assignee.id))
    .where(and(...conds))
    .orderBy(desc(inquiries.createdAt))
    .limit(5000);
}

/** Lightweight counts for the resident's mobile dashboard. */
export async function getResidentStats(residentId: string) {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where status not in ('RESOLVED','REJECTED','CLOSED'))::int`,
      resolved: sql<number>`count(*) filter (where status in ('RESOLVED','CLOSED'))::int`,
    })
    .from(inquiries)
    .where(eq(inquiries.residentId, residentId));
  return counts ?? { total: 0, active: 0, resolved: 0 };
}

/** Assignable staff for the dropdown in the admin panel. */
export async function listAssignableStaff(organizationId: string) {
  const rows = await db
    .select({
      id: users.id,
      name: sql<string>`trim(concat(${users.firstName}, ' ', ${users.lastName}))`,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId));

  // De-dup in case of multiple memberships.
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}
