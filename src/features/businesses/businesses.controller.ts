import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import * as service from './businesses.service';
import {
  createBusinessCategorySchema,
  updateBusinessCategorySchema,
  createBusinessSchema,
  updateBusinessSchema,
  verifyBusinessSchema,
  businessListQuerySchema,
  createBusinessProductSchema,
  createBusinessServiceItemSchema,
  updateWorkingHoursSchema,
  businessReviewQuerySchema,
  addProductImageSchema,
  reorderProductImagesSchema,
} from './businesses.schema';

const idParam = z.object({ id: z.string().uuid() });
const bizItemParam = z.object({ businessId: z.string().uuid(), itemId: z.string().uuid() });
const bizItemImageParam = z.object({
  businessId: z.string().uuid(),
  itemId: z.string().uuid(),
  imageId: z.string().uuid(),
});

// ── Categories ───────────────────────────────────────────────────────────────

export async function listCategoriesHandler(request: FastifyRequest, reply: FastifyReply) {
  const categories = await service.listCategories(request.organizationId!);
  return reply.send(ok(categories));
}

export async function createCategoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createBusinessCategorySchema.parse(request.body);
  const result = await service.createCategory(request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'business_category',
    resourceId: result.id,
    metadata: { name: result.name },
  });
  return reply.status(201).send(ok(result));
}

export async function updateCategoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateBusinessCategorySchema.parse(request.body);
  const result = await service.updateCategory(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'business_category',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function deleteCategoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteCategory(request.organizationId!, id);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'business_category',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}

export async function seedCategoriesHandler(request: FastifyRequest, reply: FastifyReply) {
  await service.seedDefaultCategories(request.organizationId!);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'seed',
    resource: 'business_category',
  });
  return reply.send(ok({ seeded: true }));
}

// ── Businesses ────────────────────────────────────────────────────────────────

export async function listBusinessesHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = businessListQuerySchema.parse(request.query);
  const result = await service.listBusinesses(request.organizationId!, query);
  return reply.send(ok(result));
}

export async function getBusinessHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const business = await service.getBusiness(request.organizationId!, id);
  return reply.send(ok(business));
}

export async function createBusinessHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createBusinessSchema.parse(request.body);
  const result = await service.createBusiness(
    request.organizationId!,
    request.authUser?.id ?? null,
    body,
  );
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'business',
    resourceId: result.id,
    metadata: { businessName: result.businessName },
  });
  return reply.status(201).send(ok(result));
}

export async function updateBusinessHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateBusinessSchema.parse(request.body);
  const result = await service.updateBusiness(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'business',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function verifyBusinessHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = verifyBusinessSchema.parse(request.body);
  const result = await service.verifyBusiness(
    request.organizationId!,
    id,
    request.authUser!.id,
    body,
  );
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: `verify:${body.action}`,
    resource: 'business',
    resourceId: id,
    metadata: { action: body.action, rejectionReason: body.rejectionReason },
  });
  return reply.send(ok(result));
}

export async function deleteBusinessHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteBusiness(request.organizationId!, id);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'business',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}

// ── Working Hours ──────────────────────────────────────────────────────────

export async function upsertWorkingHoursHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateWorkingHoursSchema.parse(request.body);
  await service.upsertWorkingHours(id, body);
  return reply.send(ok({ updated: true }));
}

// ── Products ──────────────────────────────────────────────────────────────

export async function listProductsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const products = await service.listProducts(id);
  return reply.send(ok(products));
}

export async function createProductHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = createBusinessProductSchema.parse(request.body);
  const result = await service.createProduct(id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'business_product',
    resourceId: result.id,
    metadata: { businessId: id, title: result.title },
  });
  return reply.status(201).send(ok(result));
}

export async function deleteProductHandler(request: FastifyRequest, reply: FastifyReply) {
  const { businessId, itemId } = bizItemParam.parse(request.params);
  await service.deleteProduct(businessId, itemId);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'business_product',
    resourceId: itemId,
  });
  return reply.send(ok({ deleted: true }));
}

// ── Product images (multiple) ─────────────────────────────────────────────────

export async function addProductImageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { businessId, itemId } = bizItemParam.parse(request.params);
  const { url } = addProductImageSchema.parse(request.body);
  const result = await service.addProductImage(businessId, itemId, url);
  return reply.status(201).send(ok(result));
}

export async function deleteProductImageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { businessId, itemId, imageId } = bizItemImageParam.parse(request.params);
  await service.deleteProductImage(businessId, itemId, imageId);
  return reply.send(ok({ deleted: true }));
}

export async function reorderProductImagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { businessId, itemId } = bizItemParam.parse(request.params);
  const { ids } = reorderProductImagesSchema.parse(request.body);
  await service.reorderProductImages(businessId, itemId, ids);
  return reply.send(ok({ reordered: true }));
}

// ── Service items ────────────────────────────────────────────────────────────

export async function createServiceItemHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = createBusinessServiceItemSchema.parse(request.body);
  const result = await service.createServiceItem(id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'business_service',
    resourceId: result.id,
    metadata: { businessId: id },
  });
  return reply.status(201).send(ok(result));
}

export async function deleteServiceItemHandler(request: FastifyRequest, reply: FastifyReply) {
  const { businessId, itemId } = bizItemParam.parse(request.params);
  await service.deleteServiceItem(businessId, itemId);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'business_service',
    resourceId: itemId,
  });
  return reply.send(ok({ deleted: true }));
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function listReviewsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = businessReviewQuerySchema.parse(request.query);
  const result = await service.listReviews(request.organizationId!, query.businessId, {
    page: query.page,
    limit: query.limit,
  });
  return reply.send(ok(result));
}

export async function hideReviewHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const result = await service.hideReview(id, request.organizationId!);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'hide',
    resource: 'business_review',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function deleteReviewHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteReview(id, request.organizationId!);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'business_review',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const analytics = await service.getAnalytics(request.organizationId!);
  return reply.send(ok(analytics));
}
