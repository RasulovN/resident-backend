import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { mobileTenantContext, mobileAuthOptional, mobileAuthGuard } from '../../common/middleware/mobile-auth';
import { ok } from '../../common/utils/response';
import { db } from '../../db/client';
import { serviceProviders, providerCallLogs, providerOrders } from './services.model';
import * as service from './services.service';

export async function mobileServiceRoutes(app: FastifyInstance) {
  // Residents are not org "members", so use the mobile tenant context (reads the
  // X-Mahalla-Id / X-Organization-Id header without an RBAC membership check).
  // mobileAuthOptional populates req.authUser when a Bearer token is present so
  // call logs / orders can still be attributed.
  app.addHook('preHandler', mobileTenantContext);
  app.addHook('preHandler', mobileAuthOptional);

  // GET /mobile/services/categories
  app.get('/categories', async (req, reply) => {
    const cats = await service.listCategories(req.organizationId!);
    return reply.send(ok(cats.filter(c => c.isActive)));
  });

  // GET /mobile/services/providers - only APPROVED
  app.get('/providers', async (req, reply) => {
    const query = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
      categoryId: z.string().uuid().optional(),
      search: z.string().optional(),
    }).parse(req.query);
    const result = await service.listProviders(req.organizationId!, {
      ...query,
      verificationStatus: 'APPROVED',
    });
    return reply.send(ok(result));
  });

  // GET /mobile/services/providers/:id
  app.get('/providers/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const provider = await service.getProvider(req.organizationId!, id);
    return reply.send(ok(provider));
  });

  // GET /mobile/services/providers/:id/reviews
  app.get('/providers/:id/reviews', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const pagination = z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().default(10) }).parse(req.query);
    const reviews = await service.listReviews(req.organizationId!, id, pagination);
    return reply.send(reviews);
  });

  // GET /mobile/services/providers/:id/services
  app.get('/providers/:id/services', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const services = await service.listProviderServices(id);
    return reply.send(ok(services));
  });

  // POST /mobile/services/providers/:id/call (log call attempt)
  app.post('/providers/:id/call', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await db.insert(providerCallLogs).values({
      providerId: id,
      organizationId: req.organizationId!,
      residentId: req.authUser?.id ?? null,
    });
    return reply.send(ok({ logged: true }));
  });

  // POST /mobile/services/orders (create order)
  app.post('/orders', async (req, reply) => {
    const { createOrderSchema } = await import('./services.schema');
    const body = createOrderSchema.parse(req.body);
    const [order] = await db.insert(providerOrders).values({
      ...body,
      organizationId: req.organizationId!,
      residentId: req.authUser?.id ?? null,
      preferredTime: body.preferredTime ? new Date(body.preferredTime) : null,
    }).returning();
    return reply.status(201).send(ok(order));
  });

  // GET /mobile/services/top-rated
  app.get('/top-rated', async (req, reply) => {
    const result = await service.listProviders(req.organizationId!, {
      page: 1, limit: 10, verificationStatus: 'APPROVED',
    });
    const sorted = result.items.sort((a: { averageRating?: string }, b: { averageRating?: string }) =>
      parseFloat(b.averageRating || '0') - parseFloat(a.averageRating || '0')
    );
    return reply.send(ok(sorted));
  });

  // DELETE /api/mobile/services/providers/:id — mahalla admin or platform admin
  app.delete('/providers/:id', { preHandler: [mobileAuthGuard] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const provider = await db.query.serviceProviders.findFirst({ where: eq(serviceProviders.id, id) });
    if (!provider) return reply.status(404).send({ status: 'error', message: 'Xizmat topilmadi' });

    const orgId = req.organizationId;
    const canDelete = req.authUser!.isPlatformAdmin ||
      (orgId && provider.organizationId === orgId) ||
      provider.userId === req.authUser!.id;

    if (!canDelete) return reply.status(403).send({ status: 'error', message: 'Ruxsat yo\'q' });

    await db.delete(serviceProviders).where(eq(serviceProviders.id, id));
    return reply.send(ok({ deleted: true }));
  });
}
