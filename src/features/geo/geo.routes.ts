import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import * as service from './geo.service';

export async function geoRoutes(app: FastifyInstance) {
  // Public — no auth required (used in signup/onboarding forms)
  app.get('/regions', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(ok(await service.listRegions()));
  });

  app.get('/districts', async (req: FastifyRequest, reply: FastifyReply) => {
    const { regionId } = z.object({ regionId: z.string().uuid().optional() }).parse(req.query);
    return reply.send(ok(await service.listDistricts(regionId)));
  });
}
