import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './inquiries.controller';

export async function inquiryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  // Read
  app.get('/', { preHandler: requirePermission('inquiries.read') }, c.listHandler);
  app.get('/stats', { preHandler: requirePermission('inquiries.read') }, c.statsHandler);
  app.get('/report', { preHandler: requirePermission('inquiries.read') }, c.reportHandler);
  app.get('/export', { preHandler: requirePermission('inquiries.read') }, c.exportHandler);
  app.get('/staff', { preHandler: requirePermission('inquiries.read') }, c.staffHandler);
  app.get('/:id', { preHandler: requirePermission('inquiries.read') }, c.getHandler);

  // Manage
  app.post('/', { preHandler: requirePermission('inquiries.manage') }, c.createHandler);
  app.patch('/:id', { preHandler: requirePermission('inquiries.manage') }, c.updateHandler);
  app.patch('/:id/status', { preHandler: requirePermission('inquiries.manage') }, c.updateStatusHandler);
  app.post('/:id/comments', { preHandler: requirePermission('inquiries.manage') }, c.commentHandler);
  app.patch('/:id/assign', { preHandler: requirePermission('inquiries.manage') }, c.assignHandler);
  app.post('/:id/extend', { preHandler: requirePermission('inquiries.manage') }, c.extendHandler);

  // Escalate (separate permission)
  app.post('/:id/escalate', { preHandler: requirePermission('inquiries.escalate') }, c.escalateHandler);
}
