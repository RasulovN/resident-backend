import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './permissions.controller';

export async function permissionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  // any member may read their own effective permissions
  app.get('/me', c.myPermissionsHandler);
  // building roles requires roles.read
  app.get('/catalog', { preHandler: requirePermission('roles.read') }, c.listOrgCatalogHandler);
}
