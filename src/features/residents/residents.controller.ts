import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import * as service from './residents.service';
import {
  createResidentSchema,
  updateResidentSchema,
  residentFilterSchema,
} from './residents.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const filter = residentFilterSchema.parse(request.query);
  const result = await service.listResidents(request.organizationId!, filter);
  return reply.send(ok(result));
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const stats = await service.getMahallaResidentStats(request.organizationId!);
  return reply.send(ok(stats));
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const resident = await service.getResident(id, request.organizationId!);
  return reply.send(ok(resident));
}

export async function profileHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const profile = await service.getResidentProfile(id, request.organizationId!);
  return reply.send(ok(profile));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createResidentSchema.parse(request.body);
  const result = await service.createResident(request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'resident',
    resourceId: result.id,
    metadata: { name: `${result.firstName} ${result.lastName}` },
  });
  return reply.status(201).send(ok(result));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateResidentSchema.parse(request.body);
  const result = await service.updateResident(id, request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'resident',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function deleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteResident(id, request.organizationId!);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'resident',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}
