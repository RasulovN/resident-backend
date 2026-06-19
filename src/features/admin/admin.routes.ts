import type { FastifyInstance } from 'fastify';
import { platformAdminGuard } from '../../common/middleware/auth';
import * as c from './admin.controller';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', platformAdminGuard);

  app.get('/stats', c.statsHandler);
  app.get('/analytics', c.analyticsHandler);
  app.get('/audit-logs', c.auditLogsHandler);
  app.get('/users/:id/activity', c.userActivityHandler);
}
