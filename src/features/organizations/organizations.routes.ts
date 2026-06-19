import type { FastifyInstance } from 'fastify';
import { authGuard, platformAdminGuard } from '../../common/middleware/auth';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './organizations.controller';

// Routes available to any authenticated user managing their own orgs.
export async function organizationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  app.post('/', c.createHandler);
  app.get('/mine', c.listMineHandler);

  // current-tenant scoped (requires X-Organization-Id)
  app.get('/current', { preHandler: tenantContext }, c.getCurrentHandler);
  app.patch(
    '/current',
    { preHandler: [tenantContext, requirePermission('organization.update')] },
    c.updateCurrentHandler,
  );
}

// Platform-admin organization management.
export async function adminOrganizationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', platformAdminGuard);

  app.get('/', c.adminListHandler);
  app.get('/:id', c.adminGetHandler);
  app.patch('/:id', c.adminUpdateHandler);
  app.post('/:id/approve', c.adminApproveHandler);
  app.post('/:id/subscription', c.adminSetSubscriptionHandler);
  app.delete('/:id', c.adminDeleteHandler);
}
