import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import * as service from './buildings.service';
import {
  buildingFilterSchema,
  createApartmentSchema,
  createBuildingSchema,
  updateBuildingSchema,
} from './buildings.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const filter = buildingFilterSchema.parse(request.query);
  const result = await service.listBuildings(request.organizationId!, {
    page: filter.page,
    limit: filter.limit,
  });
  return reply.send(ok(result));
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const building = await service.getBuilding(id, request.organizationId!);
  return reply.send(ok(building));
}

export async function profileHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const profile = await service.getBuildingProfile(id, request.organizationId!);
  return reply.send(ok(profile));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createBuildingSchema.parse(request.body);
  const result = await service.createBuilding(request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'building',
    resourceId: result.id,
    metadata: { number: result.number },
  });
  return reply.status(201).send(ok(result));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateBuildingSchema.parse(request.body);
  const result = await service.updateBuilding(id, request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'building',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function listApartmentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const apts = await service.listApartments(id);
  return reply.send(ok(apts));
}

export async function createApartmentHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = createApartmentSchema.parse(request.body);
  const result = await service.createApartment(id, body);
  return reply.status(201).send(ok(result));
}
