import type { FastifyInstance } from 'fastify';
import { platformAdminGuard } from '../../common/middleware/auth';
import * as c from './settings.controller';

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', platformAdminGuard);

  app.get('/', c.getHandler);
  app.patch('/', c.updateHandler);
}
