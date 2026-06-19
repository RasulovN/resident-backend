import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './roles.controller';

export async function roleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  app.get('/', { preHandler: requirePermission('roles.read') }, c.listHandler);
  app.get('/:id', { preHandler: requirePermission('roles.read') }, c.getHandler);
  app.post('/', { preHandler: requirePermission('roles.create') }, c.createHandler);
  app.patch('/:id', { preHandler: requirePermission('roles.update') }, c.updateHandler);
  app.delete('/:id', { preHandler: requirePermission('roles.delete') }, c.deleteHandler);
}
