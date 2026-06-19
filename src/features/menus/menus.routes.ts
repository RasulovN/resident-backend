import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './menus.controller';

export async function menuRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  // any member can read the menu tree (visibility is further filtered client-side)
  app.get('/', c.listHandler);
  app.post('/', { preHandler: requirePermission('menus.create') }, c.createHandler);
  app.patch('/reorder', { preHandler: requirePermission('menus.update') }, c.reorderHandler);
  app.patch('/:id', { preHandler: requirePermission('menus.update') }, c.updateHandler);
  app.delete('/:id', { preHandler: requirePermission('menus.delete') }, c.deleteHandler);
}
