import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import * as service from './subscriptions.service';
import { createPlanSchema, updatePlanSchema } from './subscriptions.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(ok(await service.listPlans(true)));
}

export async function adminListHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(ok(await service.listPlans(false)));
}

export async function adminCreateHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createPlanSchema.parse(request.body);
  return reply.status(201).send(ok(await service.createPlan(body)));
}

export async function adminUpdateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updatePlanSchema.parse(request.body);
  return reply.send(ok(await service.updatePlan(id, body)));
}

export async function adminDeleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  await service.deletePlan(id);
  return reply.send(ok({ deleted: true }));
}
