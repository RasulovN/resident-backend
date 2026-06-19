import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './services.controller';

export async function serviceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  // Categories (read = public within org, write = providers.manage)
  app.get('/categories', c.listCategoriesHandler);
  app.post('/categories', { preHandler: requirePermission('providers.manage') }, c.createCategoryHandler);
  app.patch('/categories/:id', { preHandler: requirePermission('providers.manage') }, c.updateCategoryHandler);
  app.delete('/categories/:id', { preHandler: requirePermission('providers.manage') }, c.deleteCategoryHandler);
  app.post('/categories/seed', { preHandler: requirePermission('providers.manage') }, c.seedCategoriesHandler);

  // Providers
  app.get('/providers', { preHandler: requirePermission('providers.read') }, c.listProvidersHandler);
  app.get('/providers/:id', { preHandler: requirePermission('providers.read') }, c.getProviderHandler);
  app.post('/providers', { preHandler: requirePermission('providers.manage') }, c.createProviderHandler);
  app.patch('/providers/:id', { preHandler: requirePermission('providers.manage') }, c.updateProviderHandler);
  app.post('/providers/:id/verify', { preHandler: requirePermission('providers.manage') }, c.verifyProviderHandler);
  app.delete('/providers/:id', { preHandler: requirePermission('providers.manage') }, c.deleteProviderHandler);

  // Provider services
  app.get('/providers/:id/services', { preHandler: requirePermission('providers.read') }, c.listProviderServicesHandler);
  app.post('/providers/:id/services', { preHandler: requirePermission('providers.manage') }, c.addProviderServiceHandler);
  app.delete('/providers/:providerId/services/:serviceId', { preHandler: requirePermission('providers.manage') }, c.removeProviderServiceHandler);

  // Reviews
  app.get('/reviews', { preHandler: requirePermission('providers.read') }, c.listReviewsHandler);
  app.patch('/reviews/:id/hide', { preHandler: requirePermission('providers.manage') }, c.hideReviewHandler);
  app.delete('/reviews/:id', { preHandler: requirePermission('providers.manage') }, c.deleteReviewHandler);

  // Orders
  app.get('/orders', { preHandler: requirePermission('providers.read') }, c.listOrdersHandler);
  app.get('/orders/stats', { preHandler: requirePermission('providers.read') }, c.getOrderStatsHandler);
  app.patch('/orders/:id/status', { preHandler: requirePermission('providers.manage') }, c.updateOrderStatusHandler);

  // Analytics
  app.get('/analytics', { preHandler: requirePermission('providers.read') }, c.getAnalyticsHandler);
}
