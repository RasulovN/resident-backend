import type { FastifyInstance } from 'fastify';
import { authGuard, platformAdminGuard } from '../../common/middleware/auth';
import * as c from './announcements.controller';

export async function announcementRoutes(app: FastifyInstance) {
  // Public (authenticated) — any logged-in user can read published announcements
  app.get('/public', { preHandler: authGuard }, c.publicListHandler);

  // Platform admin only
  app.register(async (admin) => {
    admin.addHook('preHandler', platformAdminGuard);
    admin.get('/', c.listHandler);
    admin.get('/stats', c.statsHandler);
    admin.post('/', c.createHandler);
    admin.post('/:id/publish', c.publishHandler);
    admin.delete('/:id', c.deleteHandler);
  });
}
