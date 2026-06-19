import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import { recordAudit } from '../../common/utils/audit';
import * as service from './announcements.service';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  priority: z.enum(['info', 'warning', 'critical']).default('info'),
  targetType: z.enum(['all', 'specific']).default('all'),
  targetOrgIds: z.array(z.string().uuid()).default([]),
});

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const rows = await service.listAnnouncements();
  return reply.send(ok(rows));
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(ok(await service.getAnnouncementStats()));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createSchema.parse(request.body);
  const row = await service.createAnnouncement(body, request.authUser!.id);
  await recordAudit({
    userId: request.authUser!.id,
    action: 'create',
    resource: 'announcement',
    resourceId: row.id,
  });
  return reply.status(201).send(ok(row));
}

export async function publishHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const row = await service.publishAnnouncement(id);
  await recordAudit({
    userId: request.authUser!.id,
    action: 'publish',
    resource: 'announcement',
    resourceId: id,
  });
  return reply.send(ok(row));
}

export async function deleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteAnnouncement(id);
  await recordAudit({
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'announcement',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}

export async function publicListHandler(request: FastifyRequest, reply: FastifyReply) {
  const rows = await service.listPublishedAnnouncements();
  return reply.send(ok(rows));
}
