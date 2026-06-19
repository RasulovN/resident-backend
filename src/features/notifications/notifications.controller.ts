import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import * as service from './notifications.service';

const VALID_TYPES = ['SYSTEM','ANNOUNCEMENT','EMERGENCY','UTILITY','EVENT','BUSINESS','SERVICE','ORDER','COMPLAINT','APPROVAL','PROMOTION'] as const;
const VALID_CHANNELS = ['PLATFORM','MAHALLA','PERSONAL'] as const;

const createSchema = z.object({
  title:          z.string().min(1).max(200),
  body:           z.string().min(1),
  type:           z.enum(VALID_TYPES).default('ANNOUNCEMENT'),
  channel:        z.enum(VALID_CHANNELS).default('MAHALLA'),
  targetType:     z.enum(['ALL','ADMINS','EVERYONE','SPECIFIC_USERS']).default('ALL'),
  targetUserIds:  z.array(z.string().uuid()).default([]),
  deepLink:       z.string().optional(),
  imageUrl:       z.string().url().optional(),
  scheduledAt:    z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

const updateSchema = createSchema.partial().omit({ channel: true });

const idParam = z.object({ id: z.string().uuid() });

const templateSchema = z.object({
  name:      z.string().min(1).max(100),
  title:     z.string().min(1).max(200),
  body:      z.string().min(1),
  type:      z.enum(VALID_TYPES).default('ANNOUNCEMENT'),
  variables: z.array(z.string()).default([]),
});

const paginationQuery = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Admin: Platform notifications ──────────────────────────────────────────

export async function adminListHandler(request: FastifyRequest, reply: FastifyReply) {
  const { limit, offset } = paginationQuery.parse(request.query);
  const rows = await service.listNotifications(null, limit, offset);
  return reply.send(ok(rows));
}

export async function adminCreateHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createSchema.parse(request.body);
  const row = await service.createNotification({ ...body, channel: 'PLATFORM' }, request.authUser!.id, null);
  return reply.status(201).send(ok(row));
}

export async function adminGetHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const row = await service.getNotification(id);
  return reply.send(ok(row));
}

export async function adminSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const row = await service.sendNotification(id);
  return reply.send(ok(row));
}

export async function adminDeleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteNotification(id);
  return reply.send(ok({ deleted: true }));
}

export async function adminAnalyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const stats = await service.getAnalytics(null);
  return reply.send(ok(stats));
}

// ─── Tenant (Mahalla admin) notifications ───────────────────────────────────

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!request.organizationId) return reply.send(ok([]));
  const { limit, offset } = paginationQuery.parse(request.query);
  const rows = await service.listNotifications(request.organizationId, limit, offset);
  return reply.send(ok(rows));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createSchema.parse(request.body);
  const row = await service.createNotification(body, request.authUser!.id, request.organizationId);
  return reply.status(201).send(ok(row));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateSchema.parse(request.body);
  const row = await service.updateNotification(id, body);
  return reply.send(ok(row));
}

export async function sendHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const row = await service.sendNotification(id);
  return reply.send(ok(row));
}

export async function cancelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const row = await service.cancelNotification(id);
  return reply.send(ok(row));
}

export async function deleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteNotification(id);
  return reply.send(ok({ deleted: true }));
}

export async function analyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const stats = await service.getAnalytics(request.organizationId);
  return reply.send(ok(stats));
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplatesHandler(request: FastifyRequest, reply: FastifyReply) {
  const rows = await service.listTemplates(request.organizationId);
  return reply.send(ok(rows));
}

export async function createTemplateHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = templateSchema.parse(request.body);
  const row = await service.createTemplate(body, request.organizationId);
  return reply.status(201).send(ok(row));
}

export async function deleteTemplateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteTemplate(id);
  return reply.send(ok({ deleted: true }));
}

// ─── User inbox ──────────────────────────────────────────────────────────────

export async function inboxHandler(request: FastifyRequest, reply: FastifyReply) {
  const { limit, offset } = paginationQuery.parse(request.query);
  const rows = await service.getUserNotifications(request.authUser!.id, limit, offset);
  return reply.send(ok(rows));
}

export async function unreadCountHandler(request: FastifyRequest, reply: FastifyReply) {
  const count = await service.getUnreadCount(request.authUser!.id);
  return reply.send(ok({ count }));
}

export async function markReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const row = await service.markAsRead(id, request.authUser!.id);
  return reply.send(ok(row));
}

export async function markAllReadHandler(request: FastifyRequest, reply: FastifyReply) {
  await service.markAllAsRead(request.authUser!.id);
  return reply.send(ok({ ok: true }));
}

// ─── Device registration ─────────────────────────────────────────────────────

const deviceSchema = z.object({
  pushToken: z.string().min(1),
  platform:  z.enum(['ios','android','web']).default('android'),
  deviceId:  z.string().min(1),
});

export async function registerDeviceHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = deviceSchema.parse(request.body);
  const row = await service.registerDevice(request.authUser!.id, body.pushToken, body.platform, body.deviceId);
  return reply.status(201).send(ok(row));
}

export async function removeDeviceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deactivateDevice(id, request.authUser!.id);
  return reply.send(ok({ removed: true }));
}
