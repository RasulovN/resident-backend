import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './households.controller';

export async function householdRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  app.get('/', { preHandler: requirePermission('households.read') }, c.listHandler);
  app.get('/stats', { preHandler: requirePermission('households.read') }, c.statsHandler);
  app.get('/:id', { preHandler: requirePermission('households.read') }, c.getHandler);
  app.get('/:id/profile', { preHandler: requirePermission('households.read') }, c.profileHandler);
  app.post('/', { preHandler: requirePermission('households.manage') }, c.createHandler);
  app.patch('/:id', { preHandler: requirePermission('households.manage') }, c.updateHandler);
  app.delete('/:id', { preHandler: requirePermission('households.manage') }, c.deleteHandler);
}
