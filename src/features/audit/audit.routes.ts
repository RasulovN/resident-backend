import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '../../common/utils/response';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import { mobileAuthGuard } from '../../common/middleware/mobile-auth';
import * as service from './audit.service';

const orgLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});

const mobileQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/** Mahalla-admin activity logs — scoped to the active organization. */
export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  app.get('/', { preHandler: requirePermission('audit.read') }, async (req, reply) => {
    const q = orgLogQuerySchema.parse(req.query);
    const result = await service.listOrgLogs(
      req.organizationId!,
      { page: q.page, limit: q.limit },
      { action: q.action, userId: q.userId, from: q.from, to: q.to, search: q.search },
    );
    return reply.send(ok(result));
  });

  app.get('/actions', { preHandler: requirePermission('audit.read') }, async (req, reply) => {
    const actions = await service.listOrgActions(req.organizationId!);
    return reply.send(ok(actions));
  });
}

/** Resident's own activity log — mobile app. */
export async function mobileActivityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', mobileAuthGuard);

  app.get('/', async (req, reply) => {
    const q = mobileQuerySchema.parse(req.query);
    const result = await service.listUserLogs(req.authUser!.id, { page: q.page, limit: q.limit });
    return reply.send(ok(result));
  });
}
