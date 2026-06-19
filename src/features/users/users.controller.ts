import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { paginationSchema } from '../../common/utils/pagination';
import { ok } from '../../common/utils/response';
import * as service from './users.service';
import { adminCreateUserSchema, adminUpdateUserSchema } from './users.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = paginationSchema.extend({ search: z.string().optional() }).parse(request.query);
  return reply.send(ok(await service.adminListUsers(query, query.search)));
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  return reply.send(ok(await service.adminGetUser(id)));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = adminCreateUserSchema.parse(request.body);
  const user = await service.adminCreateUser(body);
  await recordAudit({
    userId: request.authUser!.id,
    action: 'create',
    resource: 'user',
    resourceId: user.id,
  });
  return reply.status(201).send(ok(user));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = adminUpdateUserSchema.parse(request.body);
  const user = await service.adminUpdateUser(id, body);
  await recordAudit({
    userId: request.authUser!.id,
    action: 'update',
    resource: 'user',
    resourceId: id,
  });
  return reply.send(ok(user));
}

export async function deleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  if (id === request.authUser!.id) {
    return reply.status(400).send({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'You cannot delete your own account' },
    });
  }
  await service.adminDeleteUser(id);
  await recordAudit({
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'user',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}
