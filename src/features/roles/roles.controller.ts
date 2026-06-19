import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import * as service from './roles.service';
import { createRoleSchema, updateRoleSchema } from './roles.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const roles = await service.listRoles(request.organizationId!);
  return reply.send(ok(roles));
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const role = await service.getRole(request.organizationId!, id);
  return reply.send(ok(role));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createRoleSchema.parse(request.body);
  const role = await service.createRole(request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'role',
    resourceId: role.id,
  });
  return reply.status(201).send(ok(role));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateRoleSchema.parse(request.body);
  const role = await service.updateRole(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'role',
    resourceId: id,
  });
  return reply.send(ok(role));
}

export async function deleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteRole(request.organizationId!, id);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'role',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}
