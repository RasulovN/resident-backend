import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, ilike } from 'drizzle-orm';
import { db } from '../../db/client';
import { ok } from '../../common/utils/response';
import { organizations } from '../organizations/organizations.model';

export async function mobileMahallaRoutes(app: FastifyInstance) {
  // GET /api/mobile/mahalla — list all active mahallas (public, for onboarding)
  app.get('/', async (req, reply) => {
    const { regionId, districtId, search } = z.object({
      regionId: z.string().uuid().optional(),
      districtId: z.string().uuid().optional(),
      search: z.string().optional(),
    }).parse(req.query);

    const conditions: ReturnType<typeof and>[] = [eq(organizations.status, 'active')];
    if (regionId) conditions.push(eq(organizations.regionId, regionId));
    if (districtId) conditions.push(eq(organizations.districtId, districtId));
    if (search) conditions.push(ilike(organizations.name, `%${search}%`));

    const items = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        address: organizations.address,
        regionId: organizations.regionId,
        districtId: organizations.districtId,
        logoUrl: organizations.logoUrl,
        status: organizations.status,
      })
      .from(organizations)
      .where(and(...conditions))
      .orderBy(organizations.name);

    return reply.send(ok(items));
  });

  // GET /api/mobile/mahalla/:id — single mahalla info
  app.get('/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [org] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, id), eq(organizations.status, 'active')));

    if (!org) return reply.status(404).send({ status: 'error', message: 'Mahalla topilmadi' });
    return reply.send(ok(org));
  });
}
