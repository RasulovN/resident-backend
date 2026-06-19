import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { sendPushNotifications } from '../../common/utils/push';
import { wsBroadcast } from '../../common/ws/ws-manager';
import {
  notificationDeliveries,
  notificationTemplates,
  notifications,
  userDevices,
  type NewNotification,
} from './notifications.model';
import { organizationMembers } from '../members/members.model';
import { mobileProfiles } from '../mobile/mobile-auth.model';

// ─── Notification CRUD ───────────────────────────────────────────────────────

export async function createNotification(
  input: Pick<NewNotification, 'title' | 'body' | 'type' | 'channel' | 'targetType' | 'targetUserIds' | 'deepLink' | 'imageUrl' | 'scheduledAt'>,
  createdById: string,
  orgId?: string | null,
) {
  const [row] = await db
    .insert(notifications)
    .values({ ...input, createdById, orgId: orgId ?? null, status: 'DRAFT' })
    .returning();
  return row!;
}

export async function listNotifications(orgId?: string | null, limit = 50, offset = 0) {
  const where = orgId ? eq(notifications.orgId, orgId) : isNull(notifications.orgId);
  return db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getNotification(id: string) {
  const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
  if (!row) throw AppError.notFound('Notification not found');
  return row;
}

export async function updateNotification(
  id: string,
  input: Partial<Pick<NewNotification, 'title' | 'body' | 'type' | 'targetType' | 'targetUserIds' | 'deepLink' | 'imageUrl' | 'scheduledAt'>>,
) {
  const [row] = await db
    .update(notifications)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.status, 'DRAFT')))
    .returning();
  if (!row) throw AppError.badRequest('Notification not found or already sent');
  return row;
}

export async function deleteNotification(id: string) {
  const [row] = await db.delete(notifications).where(eq(notifications.id, id)).returning({ id: notifications.id });
  if (!row) throw AppError.notFound('Notification not found');
}

export async function cancelNotification(id: string) {
  const [row] = await db
    .update(notifications)
    .set({ status: 'CANCELLED', updatedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.status, 'SCHEDULED')))
    .returning();
  if (!row) throw AppError.badRequest('Only scheduled notifications can be cancelled');
  return row;
}

// ─── Send Logic ──────────────────────────────────────────────────────────────

export async function sendNotification(id: string) {
  const notif = await getNotification(id);
  if (!['DRAFT', 'SCHEDULED'].includes(notif.status)) {
    throw AppError.badRequest('Notification is not in a sendable state');
  }

  // Mark as SENDING
  await db.update(notifications).set({ status: 'SENDING', updatedAt: new Date() }).where(eq(notifications.id, id));

  // Resolve target user IDs
  let userIds: string[] = [];

  if (notif.targetType === 'SPECIFIC_USERS') {
    userIds = notif.targetUserIds as string[];
  } else if (notif.targetType === 'ADMINS') {
    if (notif.channel === 'PLATFORM') {
      // All org members across all mahallas (platform-level)
      const rows = await db
        .selectDistinct({ userId: organizationMembers.userId })
        .from(organizationMembers);
      userIds = rows.map((r) => r.userId);
    } else if (notif.orgId) {
      // This mahalla's org members
      const rows = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, notif.orgId));
      userIds = rows.map((r) => r.userId);
    }
  } else if (notif.targetType === 'EVERYONE' && notif.channel === 'PLATFORM') {
    // All mobile residents + all org members across the whole platform
    const [mobileRows, adminRows] = await Promise.all([
      db.select({ userId: mobileProfiles.userId })
        .from(mobileProfiles)
        .where(eq(mobileProfiles.onboardingCompleted, true)),
      db.selectDistinct({ userId: organizationMembers.userId })
        .from(organizationMembers),
    ]);
    userIds = [...new Set([
      ...mobileRows.map((r) => r.userId),
      ...adminRows.map((r) => r.userId),
    ])];
  } else if (notif.channel === 'PLATFORM') {
    // ALL — all mobile users system-wide
    const rows = await db
      .select({ userId: mobileProfiles.userId })
      .from(mobileProfiles)
      .where(eq(mobileProfiles.onboardingCompleted, true));
    userIds = rows.map((r) => r.userId);
  } else if (notif.orgId) {
    // MAHALLA channel, ALL — mobile residents who selected this mahalla
    const rows = await db
      .select({ userId: mobileProfiles.userId })
      .from(mobileProfiles)
      .where(and(
        eq(mobileProfiles.selectedMahallaId, notif.orgId),
        eq(mobileProfiles.onboardingCompleted, true),
      ));
    userIds = rows.map((r) => r.userId);
  }

  if (userIds.length === 0) {
    await db.update(notifications)
      .set({ status: 'SENT', sentAt: new Date(), deliveryCount: { total: 0, delivered: 0, read: 0 }, updatedAt: new Date() })
      .where(eq(notifications.id, id));
    return getNotification(id);
  }

  // Insert delivery records (upsert — ignore if already exists)
  const deliveryRows = userIds.map((userId) => ({ notificationId: id, userId }));
  await db
    .insert(notificationDeliveries)
    .values(deliveryRows)
    .onConflictDoNothing();

  // Real-time WebSocket broadcast to connected users
  wsBroadcast(userIds, {
    type: 'notification',
    payload: {
      id: notif.id,
      title: notif.title,
      body: notif.body,
      type: notif.type,
      channel: notif.channel,
      deepLink: notif.deepLink,
      createdAt: new Date().toISOString(),
    },
  });

  // Fetch push tokens
  const deviceRows = await db
    .select({ pushToken: userDevices.pushToken })
    .from(userDevices)
    .where(and(inArray(userDevices.userId, userIds), eq(userDevices.isActive, true)));

  const tokens = deviceRows.map((d) => d.pushToken);

  // Send push notifications
  if (tokens.length > 0) {
    await sendPushNotifications(
      tokens.map((token) => ({
        to: token,
        title: notif.title,
        body: notif.body,
        data: { notificationId: id, deepLink: notif.deepLink ?? undefined },
        sound: 'default' as const,
        priority: notif.type === 'EMERGENCY' ? 'high' as const : 'default' as const,
        channelId: notif.type === 'EMERGENCY' ? 'emergency' : 'default',
      })),
    );

    // Mark deliveries as delivered
    await db
      .update(notificationDeliveries)
      .set({ deliveredAt: new Date() })
      .where(eq(notificationDeliveries.notificationId, id));
  }

  // Mark notification as SENT
  const [updated] = await db
    .update(notifications)
    .set({
      status: 'SENT',
      sentAt: new Date(),
      deliveryCount: { total: userIds.length, delivered: tokens.length, read: 0 },
      updatedAt: new Date(),
    })
    .where(eq(notifications.id, id))
    .returning();

  return updated!;
}

// ─── User Inbox ──────────────────────────────────────────────────────────────

export async function getUserNotifications(userId: string, limit = 30, offset = 0) {
  return db
    .select({
      id: notificationDeliveries.id,
      notificationId: notificationDeliveries.notificationId,
      isRead: notificationDeliveries.isRead,
      readAt: notificationDeliveries.readAt,
      deliveredAt: notificationDeliveries.deliveredAt,
      createdAt: notificationDeliveries.createdAt,
      title: notifications.title,
      body: notifications.body,
      type: notifications.type,
      deepLink: notifications.deepLink,
      imageUrl: notifications.imageUrl,
      sentAt: notifications.sentAt,
    })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notificationDeliveries.notificationId, notifications.id))
    .where(eq(notificationDeliveries.userId, userId))
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getUnreadCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationDeliveries)
    .where(and(eq(notificationDeliveries.userId, userId), eq(notificationDeliveries.isRead, false)));
  return row?.count ?? 0;
}

export async function markAsRead(deliveryId: string, userId: string) {
  const [row] = await db
    .update(notificationDeliveries)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notificationDeliveries.id, deliveryId), eq(notificationDeliveries.userId, userId)))
    .returning();
  if (!row) throw AppError.notFound('Notification not found');

  // Increment read count on notification
  await db
    .update(notifications)
    .set({
      deliveryCount: sql`jsonb_set(delivery_count, '{read}', (COALESCE((delivery_count->>'read')::int, 0) + 1)::text::jsonb)`,
      updatedAt: new Date(),
    })
    .where(eq(notifications.id, row.notificationId));

  return row;
}

export async function markAllAsRead(userId: string) {
  await db
    .update(notificationDeliveries)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notificationDeliveries.userId, userId), eq(notificationDeliveries.isRead, false)));
}

// ─── Device Registration ─────────────────────────────────────────────────────

export async function registerDevice(userId: string, pushToken: string, platform: string, deviceId: string) {
  const [row] = await db
    .insert(userDevices)
    .values({ userId, pushToken, platform, deviceId, isActive: true })
    .onConflictDoUpdate({
      target: [userDevices.deviceId],
      set: { pushToken, isActive: true, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function deactivateDevice(deviceId: string, userId: string) {
  await db
    .update(userDevices)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(userDevices.deviceId, deviceId), eq(userDevices.userId, userId)));
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(orgId?: string | null) {
  const where = orgId ? eq(notificationTemplates.orgId, orgId) : isNull(notificationTemplates.orgId);
  return db.select().from(notificationTemplates).where(where).orderBy(desc(notificationTemplates.createdAt));
}

export async function createTemplate(
  input: Pick<typeof notificationTemplates.$inferInsert, 'name' | 'title' | 'body' | 'type' | 'variables'>,
  orgId?: string | null,
) {
  const [row] = await db
    .insert(notificationTemplates)
    .values({ ...input, orgId: orgId ?? null })
    .returning();
  return row!;
}

export async function deleteTemplate(id: string) {
  await db.delete(notificationTemplates).where(eq(notificationTemplates.id, id));
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getAnalytics(orgId?: string | null) {
  const where = orgId ? eq(notifications.orgId, orgId) : isNull(notifications.orgId);

  const [total] = await db.select({ value: sql<number>`count(*)::int` }).from(notifications).where(where);
  const [sent] = await db.select({ value: sql<number>`count(*)::int` }).from(notifications)
    .where(and(where, eq(notifications.status, 'SENT')));
  const [draft] = await db.select({ value: sql<number>`count(*)::int` }).from(notifications)
    .where(and(where, eq(notifications.status, 'DRAFT')));
  const [scheduled] = await db.select({ value: sql<number>`count(*)::int` }).from(notifications)
    .where(and(where, eq(notifications.status, 'SCHEDULED')));

  const [deliveryStats] = await db
    .select({
      totalDelivered: sql<number>`COALESCE(sum((delivery_count->>'delivered')::int), 0)::int`,
      totalRead:      sql<number>`COALESCE(sum((delivery_count->>'read')::int), 0)::int`,
      totalSent:      sql<number>`COALESCE(sum((delivery_count->>'total')::int), 0)::int`,
    })
    .from(notifications)
    .where(and(where, eq(notifications.status, 'SENT')));

  return {
    total:          total?.value ?? 0,
    sent:           sent?.value ?? 0,
    draft:          draft?.value ?? 0,
    scheduled:      scheduled?.value ?? 0,
    totalDelivered: deliveryStats?.totalDelivered ?? 0,
    totalRead:      deliveryStats?.totalRead ?? 0,
    totalSent:      deliveryStats?.totalSent ?? 0,
    readRate: deliveryStats?.totalDelivered
      ? Math.round(((deliveryStats.totalRead ?? 0) / (deliveryStats.totalDelivered)) * 100)
      : 0,
  };
}
