import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import * as service from './households.service';
import {
  createHouseholdSchema,
  householdFilterSchema,
  updateHouseholdSchema,
} from './households.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const filter = householdFilterSchema.parse(request.query);
  const result = await service.listHouseholds(request.organizationId!, filter);
  return reply.send(ok(result));
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const stats = await service.getMahallaHouseholdStats(request.organizationId!);
  return reply.send(ok(stats));
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const household = await service.getHousehold(id, request.organizationId!);
  return reply.send(ok(household));
}

export async function profileHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const profile = await service.getHouseholdProfile(id, request.organizationId!);
  return reply.send(ok(profile));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createHouseholdSchema.parse(request.body);
  const result = await service.createHousehold(request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'household',
    resourceId: result.id,
    metadata: { name: result.householdName },
  });
  return reply.status(201).send(ok(result));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateHouseholdSchema.parse(request.body);
  const result = await service.updateHousehold(id, request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'household',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function deleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteHousehold(id, request.organizationId!);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'household',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}
