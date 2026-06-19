import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './members.controller';

export async function memberRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  app.get('/', { preHandler: requirePermission('members.read') }, c.listHandler);
  app.post('/', { preHandler: requirePermission('members.create') }, c.addHandler);
  app.patch('/:id', { preHandler: requirePermission('members.update') }, c.updateHandler);
  app.delete('/:id', { preHandler: requirePermission('members.delete') }, c.removeHandler);
  app.get('/:id/activity', { preHandler: requirePermission('members.read') }, c.memberActivityHandler);
}
