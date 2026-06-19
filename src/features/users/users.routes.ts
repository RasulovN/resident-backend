import type { FastifyInstance } from 'fastify';
import { platformAdminGuard } from '../../common/middleware/auth';
import * as c from './users.controller';

export async function adminUserRoutes(app: FastifyInstance) {
  app.addHook('preHandler', platformAdminGuard);

  app.get('/', c.listHandler);
  app.get('/:id', c.getHandler);
  app.post('/', c.createHandler);
  app.patch('/:id', c.updateHandler);
  app.delete('/:id', c.deleteHandler);
}
