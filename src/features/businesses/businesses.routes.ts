import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../common/middleware/permission';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './businesses.controller';

export async function businessRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  // Categories
  app.get('/categories', c.listCategoriesHandler);
  app.post('/categories', { preHandler: requirePermission('businesses.manage') }, c.createCategoryHandler);
  app.patch('/categories/:id', { preHandler: requirePermission('businesses.manage') }, c.updateCategoryHandler);
  app.delete('/categories/:id', { preHandler: requirePermission('businesses.manage') }, c.deleteCategoryHandler);
  app.post('/categories/seed', { preHandler: requirePermission('businesses.manage') }, c.seedCategoriesHandler);

  // Businesses — CRUD
  app.get('/', { preHandler: requirePermission('businesses.read') }, c.listBusinessesHandler);
  app.get('/:id', { preHandler: requirePermission('businesses.read') }, c.getBusinessHandler);
  app.post('/', { preHandler: requirePermission('businesses.manage') }, c.createBusinessHandler);
  app.patch('/:id', { preHandler: requirePermission('businesses.manage') }, c.updateBusinessHandler);
  app.delete('/:id', { preHandler: requirePermission('businesses.manage') }, c.deleteBusinessHandler);

  // Verification
  app.post('/:id/verify', { preHandler: requirePermission('businesses.manage') }, c.verifyBusinessHandler);

  // Working hours
  app.put('/:id/hours', { preHandler: requirePermission('businesses.manage') }, c.upsertWorkingHoursHandler);

  // Products
  app.get('/:id/products', { preHandler: requirePermission('businesses.read') }, c.listProductsHandler);
  app.post('/:id/products', { preHandler: requirePermission('businesses.manage') }, c.createProductHandler);
  app.delete('/:businessId/products/:itemId', { preHandler: requirePermission('businesses.manage') }, c.deleteProductHandler);

  // Product images (multiple)
  app.post('/:businessId/products/:itemId/images', { preHandler: requirePermission('businesses.manage') }, c.addProductImageHandler);
  app.put('/:businessId/products/:itemId/images/order', { preHandler: requirePermission('businesses.manage') }, c.reorderProductImagesHandler);
  app.delete('/:businessId/products/:itemId/images/:imageId', { preHandler: requirePermission('businesses.manage') }, c.deleteProductImageHandler);

  // Service items
  app.post('/:id/services', { preHandler: requirePermission('businesses.manage') }, c.createServiceItemHandler);
  app.delete('/:businessId/services/:itemId', { preHandler: requirePermission('businesses.manage') }, c.deleteServiceItemHandler);

  // Reviews
  app.get('/reviews', { preHandler: requirePermission('businesses.read') }, c.listReviewsHandler);
  app.patch('/reviews/:id/hide', { preHandler: requirePermission('businesses.manage') }, c.hideReviewHandler);
  app.delete('/reviews/:id', { preHandler: requirePermission('businesses.manage') }, c.deleteReviewHandler);

  // Analytics
  app.get('/analytics', { preHandler: requirePermission('businesses.read') }, c.getAnalyticsHandler);
}
