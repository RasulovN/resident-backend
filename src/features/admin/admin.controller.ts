import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import { paginationSchema } from '../../common/utils/pagination';
import * as service from './admin.service';

const auditQuerySchema = paginationSchema.extend({
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});

const analyticsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

const idParam = z.object({ id: z.string().uuid() });

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(ok(await service.adminGetStats()));
}

export async function analyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { months } = analyticsQuerySchema.parse(request.query);
  return reply.send(ok(await service.adminGetAnalytics(months)));
}

export async function auditLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = auditQuerySchema.parse(request.query);
  return reply.send(await service.adminListAuditLogs(query, query));
}

export async function userActivityHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const pagination = paginationSchema.parse(request.query);
  return reply.send(await service.adminGetUserActivity(id, pagination));
}
