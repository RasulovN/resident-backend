import type { FastifyInstance } from 'fastify';
import { authGuard, platformAdminGuard } from '../../common/middleware/auth';
import * as c from './subscriptions.controller';

export async function planRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);
  app.get('/', c.listHandler);
}

export async function adminPlanRoutes(app: FastifyInstance) {
  app.addHook('preHandler', platformAdminGuard);
  app.get('/', c.adminListHandler);
  app.post('/', c.adminCreateHandler);
  app.patch('/:id', c.adminUpdateHandler);
  app.delete('/:id', c.adminDeleteHandler);
}
