import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '../../common/utils/response';
import { AppError } from '../../common/errors/app-error';
import { mobileAuthGuard, mobileTenantContext } from '../../common/middleware/mobile-auth';
import { recordAudit } from '../../common/utils/audit';
import * as service from './inquiries.service';
import {
  createInquirySchema,
  addCommentSchema,
  rateSchema,
  residentListQuerySchema,
} from './inquiries.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function mobileInquiryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', mobileAuthGuard);

  // GET /api/mobile/inquiries — resident's own appeals
  app.get('/', async (req, reply) => {
    const query = residentListQuerySchema.parse(req.query);
    const result = await service.listResidentInquiries(req.authUser!.id, query);
    return reply.send(ok(result));
  });

  // GET /api/mobile/inquiries/stats — counts for the resident dashboard
  app.get('/stats', async (req, reply) => {
    const stats = await service.getResidentStats(req.authUser!.id);
    return reply.send(ok(stats));
  });

  // GET /api/mobile/inquiries/:id — detail + public timeline
  app.get('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const inquiry = await service.getResidentInquiry(req.authUser!.id, id);
    return reply.send(ok(inquiry));
  });

  // POST /api/mobile/inquiries — submit a new appeal to the selected mahalla
  app.post('/', { preHandler: mobileTenantContext }, async (req, reply) => {
    const orgId = req.organizationId;
    if (!orgId) throw AppError.badRequest('X-Mahalla-Id sarlavhasi talab qilinadi');
    const body = createInquirySchema.parse(req.body);
    const result = await service.createInquiry(orgId, req.authUser!.id, body);
    await recordAudit({
      organizationId: orgId,
      userId: req.authUser!.id,
      action: 'inquiry.create',
      resource: 'inquiry',
      resourceId: result.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { ticketNumber: result.ticketNumber, channel: 'mobile' },
    });
    return reply.status(201).send(ok(result));
  });

  // POST /api/mobile/inquiries/:id/comments — reply to staff
  app.post('/:id/comments', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = addCommentSchema.parse({ ...(req.body as object), isInternal: false });
    await service.addResidentComment(req.authUser!.id, id, body);
    await recordAudit({
      userId: req.authUser!.id,
      action: 'inquiry.comment',
      resource: 'inquiry',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { channel: 'mobile' },
    });
    return reply.status(201).send(ok({ added: true }));
  });

  // POST /api/mobile/inquiries/:id/rate — rate a resolved appeal
  app.post('/:id/rate', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = rateSchema.parse(req.body);
    const result = await service.rateInquiry(req.authUser!.id, id, body);
    return reply.send(ok(result));
  });
}
