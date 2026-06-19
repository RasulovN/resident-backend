import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './residents.controller';

export async function residentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  app.get('/', { preHandler: requirePermission('residents.read') }, c.listHandler);
  app.get('/stats', { preHandler: requirePermission('residents.read') }, c.statsHandler);
  app.get('/:id', { preHandler: requirePermission('residents.read') }, c.getHandler);
  app.get('/:id/profile', { preHandler: requirePermission('residents.read') }, c.profileHandler);
  app.post('/', { preHandler: requirePermission('residents.create') }, c.createHandler);
  app.patch('/:id', { preHandler: requirePermission('residents.update') }, c.updateHandler);
  app.delete('/:id', { preHandler: requirePermission('residents.delete') }, c.deleteHandler);
}
