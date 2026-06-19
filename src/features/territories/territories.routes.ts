import type { FastifyInstance } from 'fastify';
import { authGuard } from '../../common/middleware/auth';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './territories.controller';

export async function territoriesRoutes(app: FastifyInstance) {
  // Public read (any authenticated user can see the map)
  app.get('/', { preHandler: authGuard }, c.listTerritoriesHandler);
  // Link current org to a territory (requires tenant context)
  app.post('/link', { preHandler: tenantContext }, c.linkTerritoryHandler);
  // Platform admin: re-seed territories with improved map data
  app.post('/reseed', { preHandler: authGuard }, c.reseedTerritoriesHandler);
}
