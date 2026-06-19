import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ok } from '../../common/utils/response';
import * as service from './territories.service';
import { reseedTerritories } from './territories.reseed';

export async function listTerritoriesHandler(_request: FastifyRequest, reply: FastifyReply) {
  const territories = await service.listTerritories();
  return reply.send(ok(territories));
}

export async function linkTerritoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { territoryId } = z.object({ territoryId: z.string().uuid().nullable() }).parse(request.body);
  await service.linkOrgToTerritory(request.organizationId!, territoryId);
  return reply.send(ok({ linked: true }));
}

export async function reseedTerritoriesHandler(_request: FastifyRequest, reply: FastifyReply) {
  await reseedTerritories();
  return reply.send(ok({ reseeded: true }));
}
