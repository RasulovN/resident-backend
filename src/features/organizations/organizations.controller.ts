import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { paginationSchema } from '../../common/utils/pagination';
import { ok } from '../../common/utils/response';
import * as service from './organizations.service';
import {
  adminSetSubscriptionSchema,
  adminUpdateOrganizationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
} from './organizations.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.authUser!.id;
  const body = createOrganizationSchema.parse(request.body);
  const org = await service.createOrganization(userId, body);
  await recordAudit({
    organizationId: org.id,
    userId,
    action: 'create',
    resource: 'organization',
    resourceId: org.id,
  });
  return reply.status(201).send(ok(org));
}

export async function listMineHandler(request: FastifyRequest, reply: FastifyReply) {
  const orgs = await service.listUserOrganizations(request.authUser!.id);
  return reply.send(ok(orgs));
}

export async function getCurrentHandler(request: FastifyRequest, reply: FastifyReply) {
  const org = await service.getOrganization(request.organizationId!);
  return reply.send(ok(org));
}

export async function updateCurrentHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = updateOrganizationSchema.parse(request.body);
  const org = await service.updateOrganization(request.organizationId!, body);
  await recordAudit({
    organizationId: org.id,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'organization',
    resourceId: org.id,
  });
  return reply.send(ok(org));
}

// ---- Platform admin ----

export async function adminListHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = paginationSchema
    .extend({
      search: z.string().optional(),
      regionId: z.string().uuid().optional(),
      districtId: z.string().uuid().optional(),
      status: z.enum(['active', 'trial', 'suspended']).optional(),
    })
    .parse(request.query);
  const result = await service.adminListOrganizations(query, {
    search: query.search,
    regionId: query.regionId,
    districtId: query.districtId,
    status: query.status,
  });
  return reply.send(ok(result));
}

export async function adminGetHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const org = await service.getOrganization(id);
  return reply.send(ok(org));
}

export async function adminUpdateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = adminUpdateOrganizationSchema.parse(request.body);
  const org = await service.adminUpdateOrganization(id, body);
  await recordAudit({
    organizationId: id,
    userId: request.authUser!.id,
    action: 'admin_update',
    resource: 'organization',
    resourceId: id,
    metadata: body,
  });
  return reply.send(ok(org));
}

export async function adminSetSubscriptionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = adminSetSubscriptionSchema.parse(request.body);
  const org = await service.adminSetSubscription(id, body);
  await recordAudit({
    organizationId: id,
    userId: request.authUser!.id,
    action: 'admin_set_subscription',
    resource: 'organization',
    resourceId: id,
    metadata: body,
  });
  return reply.send(ok(org));
}

export async function adminApproveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const org = await service.adminApproveOrganization(id);
  await recordAudit({
    organizationId: id,
    userId: request.authUser!.id,
    action: 'admin_approve',
    resource: 'organization',
    resourceId: id,
  });
  return reply.send(ok(org));
}

export async function adminDeleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.adminDeleteOrganization(id);
  await recordAudit({
    userId: request.authUser!.id,
    action: 'admin_delete',
    resource: 'organization',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}
