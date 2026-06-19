import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './buildings.controller';

export async function buildingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  app.get('/', { preHandler: requirePermission('buildings.read') }, c.listHandler);
  app.get('/:id', { preHandler: requirePermission('buildings.read') }, c.getHandler);
  app.get('/:id/profile', { preHandler: requirePermission('buildings.read') }, c.profileHandler);
  app.post('/', { preHandler: requirePermission('buildings.manage') }, c.createHandler);
  app.patch('/:id', { preHandler: requirePermission('buildings.manage') }, c.updateHandler);
  app.get('/:id/apartments', { preHandler: requirePermission('buildings.read') }, c.listApartmentsHandler);
  app.post('/:id/apartments', { preHandler: requirePermission('buildings.manage') }, c.createApartmentHandler);
}
