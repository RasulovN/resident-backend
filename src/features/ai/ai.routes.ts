import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './ai.controller';

export async function aiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  app.get('/status', { preHandler: requirePermission('reports.read') }, c.statusHandler);
  app.post('/chat', { preHandler: requirePermission('reports.read') }, c.chatHandler);
  app.post('/analyze', { preHandler: requirePermission('reports.read') }, c.analyzeHandler);
  app.post('/forecast', { preHandler: requirePermission('reports.read') }, c.forecastHandler);
  app.get('/anomalies', { preHandler: requirePermission('reports.read') }, c.anomaliesHandler);
}
