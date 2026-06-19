import type { FastifyInstance } from 'fastify';
import { requireEntityPermission, requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './entities.controller';

export async function entityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  // --- Entity definitions & fields: managed via `entities.*` permissions ---
  app.get('/', { preHandler: requirePermission('entities.read') }, c.listEntitiesHandler);
  app.post('/', { preHandler: requirePermission('entities.create') }, c.createEntityHandler);
  app.get('/:entityId', { preHandler: requirePermission('entities.read') }, c.getEntityHandler);
  app.patch(
    '/:entityId',
    { preHandler: requirePermission('entities.update') },
    c.updateEntityHandler,
  );
  app.delete(
    '/:entityId',
    { preHandler: requirePermission('entities.delete') },
    c.deleteEntityHandler,
  );

  app.post(
    '/:entityId/fields',
    { preHandler: requirePermission('entities.update') },
    c.createFieldHandler,
  );
  app.patch(
    '/:entityId/fields/:fieldId',
    { preHandler: requirePermission('entities.update') },
    c.updateFieldHandler,
  );
  app.delete(
    '/:entityId/fields/:fieldId',
    { preHandler: requirePermission('entities.update') },
    c.deleteFieldHandler,
  );

  // --- Records: gated by per-entity dynamic permissions ---
  app.get(
    '/:entityId/records',
    { preHandler: requireEntityPermission('read') },
    c.listRecordsHandler,
  );
  app.post(
    '/:entityId/records',
    { preHandler: requireEntityPermission('create') },
    c.createRecordHandler,
  );
  app.patch(
    '/:entityId/records/:recordId',
    { preHandler: requireEntityPermission('update') },
    c.updateRecordHandler,
  );
  app.delete(
    '/:entityId/records/:recordId',
    { preHandler: requireEntityPermission('delete') },
    c.deleteRecordHandler,
  );
}
