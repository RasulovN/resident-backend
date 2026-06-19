import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import * as service from './menus.service';
import { createMenuSchema, reorderMenuSchema, updateMenuSchema } from './menus.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const tree = await service.getMenuTree(request.organizationId!);
  return reply.send(ok(tree));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createMenuSchema.parse(request.body);
  const menu = await service.createMenu(request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'menu',
    resourceId: menu.id,
  });
  return reply.status(201).send(ok(menu));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateMenuSchema.parse(request.body);
  const menu = await service.updateMenu(request.organizationId!, id, body);
  return reply.send(ok(menu));
}

export async function deleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deleteMenu(request.organizationId!, id);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'menu',
    resourceId: id,
  });
  return reply.send(ok({ deleted: true }));
}

export async function reorderHandler(request: FastifyRequest, reply: FastifyReply) {
  const { items } = reorderMenuSchema.parse(request.body);
  await service.reorderMenus(request.organizationId!, items);
  return reply.send(ok({ reordered: true }));
}
