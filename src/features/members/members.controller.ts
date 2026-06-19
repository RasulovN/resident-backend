import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { recordAudit } from '../../common/utils/audit';
import { paginationSchema } from '../../common/utils/pagination';
import { ok } from '../../common/utils/response';
import { adminGetUserActivity } from '../admin/admin.service';
import * as service from './members.service';
import { addMemberSchema, updateMemberSchema } from './members.schema';
import { organizationMembers } from './members.model';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const members = await service.listMembers(request.organizationId!);
  return reply.send(ok(members));
}

export async function addHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = addMemberSchema.parse(request.body);
  const result = await service.addMember(request.organizationId!, request.authUser!.id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'member',
    resourceId: result.id,
    metadata: { email: body.email },
  });
  return reply.status(201).send(ok(result));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateMemberSchema.parse(request.body);
  const result = await service.updateMember(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'member',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function removeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.removeMember(request.organizationId!, id, request.authUser!.id);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'member',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}

export async function memberActivityHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const pagination = paginationSchema.parse(request.query);

  // Verify member belongs to the requesting org
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, id),
      eq(organizationMembers.organizationId, request.organizationId!),
    ),
  });
  if (!member) throw AppError.notFound('Member not found');

  return reply.send(await adminGetUserActivity(member.userId, pagination));
}
