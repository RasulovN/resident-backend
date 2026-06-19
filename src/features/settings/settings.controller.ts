import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import { recordAudit } from '../../common/utils/audit';
import * as service from './settings.service';

const patchSchema = z.record(z.string(), z.unknown());

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(ok(await service.getAllSettings()));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = patchSchema.parse(request.body);
  const updated = await service.updateSettings(body);
  await recordAudit({
    userId: request.authUser!.id,
    action: 'update',
    resource: 'system_settings',
    metadata: { keys: Object.keys(body) },
  });
  return reply.send(ok(updated));
}
