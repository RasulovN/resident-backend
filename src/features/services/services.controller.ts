import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import { paginationSchema } from '../../common/utils/pagination';
import * as service from './services.service';
import {
  createCategorySchema,
  updateCategorySchema,
  createProviderSchema,
  updateProviderSchema,
  verifyProviderSchema,
  createProviderServiceSchema,
  updateOrderStatusSchema,
  providerListQuerySchema,
} from './services.schema';

const idParam = z.object({ id: z.string().uuid() });
const providerServiceParams = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
});

// ── Categories ──

export async function listCategoriesHandler(request: FastifyRequest, reply: FastifyReply) {
  const categories = await service.listCategories(request.organizationId!);
  return reply.send(ok(categories));
}

export async function createCategoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createCategorySchema.parse(request.body);
  const result = await service.createCategory(request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'service_category',
    resourceId: result.id,
    metadata: { name: result.name },
  });
  return reply.status(201).send(ok(result));
}

export async function updateCategoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateCategorySchema.parse(request.body);
  const result = await service.updateCategory(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'service_category',
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
    resource: 'service_category',
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
    resource: 'service_category',
  });
  return reply.send(ok({ seeded: true }));
}

// ── Providers ──

export async function listProvidersHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = providerListQuerySchema.parse(request.query);
  const result = await service.listProviders(request.organizationId!, query);
  return reply.send(ok(result));
}

export async function getProviderHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const provider = await service.getProvider(request.organizationId!, id);
  return reply.send(ok(provider));
}

export async function createProviderHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createProviderSchema.parse(request.body);
  const result = await service.createProvider(
    request.organizationId!,
    request.authUser?.id ?? null,
    body,
  );
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'service_provider',
    resourceId: result.id,
    metadata: { businessName: result.businessName },
  });
  return reply.status(201).send(ok(result));
}

export async function updateProviderHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateProviderSchema.parse(request.body);
  const result = await service.updateProvider(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'service_provider',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function verifyProviderHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = verifyProviderSchema.parse(request.body);
  const result = await service.verifyProvider(
    request.organizationId!,
    id,
    request.authUser!.id,
    body,
  );
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: `verify:${body.action}`,
    resource: 'service_provider',
    resourceId: id,
    metadata: { action: body.action },
  });
  return reply.send(ok(result));
}

export async function deleteProviderHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteProvider(request.organizationId!, id);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'service_provider',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}

// ── Provider Services ──

export async function listProviderServicesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const services = await service.listProviderServices(id);
  return reply.send(ok(services));
}

export async function addProviderServiceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = createProviderServiceSchema.parse(request.body);
  const result = await service.addProviderService(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'provider_service',
    resourceId: result.id,
    metadata: { providerId: id, serviceName: result.serviceName },
  });
  return reply.status(201).send(ok(result));
}

export async function removeProviderServiceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { providerId, serviceId } = providerServiceParams.parse(request.params);
  await service.removeProviderService(request.organizationId!, providerId, serviceId);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'provider_service',
    resourceId: serviceId,
    metadata: { providerId },
  });
  return reply.send(ok({ deleted: true }));
}

// ── Reviews ──

export async function listReviewsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      providerId: z.string().uuid().optional(),
    })
    .parse(request.query);
  const result = await service.listReviews(request.organizationId!, query.providerId, {
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
    resource: 'provider_review',
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
    resource: 'provider_review',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}

// ── Orders ──

export async function listOrdersHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.string().optional(),
    })
    .parse(request.query);
  const result = await service.listOrders(request.organizationId!, query.status, {
    page: query.page,
    limit: query.limit,
  });
  return reply.send(ok(result));
}

export async function getOrderStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const stats = await service.getOrderStats(request.organizationId!);
  return reply.send(ok(stats));
}

export async function updateOrderStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateOrderStatusSchema.parse(request.body);
  const result = await service.updateOrderStatus(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update_status',
    resource: 'provider_order',
    resourceId: id,
    metadata: { status: body.status },
  });
  return reply.send(ok(result));
}

// ── Analytics ──

export async function getAnalyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const analytics = await service.getAnalytics(request.organizationId!);
  return reply.send(ok(analytics));
}
