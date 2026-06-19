import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { ok } from '../../common/utils/response';
import { mobileAuthGuard, mobileTenantContext } from '../../common/middleware/mobile-auth';
import { residents } from '../residents/residents.model';
import { businesses, businessWorkingHours, businessProducts, businessReservations } from '../businesses/businesses.model';
import * as bizService from '../businesses/businesses.service';
import * as profileService from './mobile-profile.service';
import { serviceProviders, providerServices } from '../services/services.model';

const addressSchema = z.object({
  street: z.string().max(200).optional(),
  building: z.string().max(100).optional(),
  apartment: z.string().max(50).optional(),
  household: z.string().max(120).optional(),
  landmark: z.string().max(200).optional(),
});

const detailsSchema = z.object({
  educationLevel: z.string().max(80).optional(),
  profession: z.string().max(120).optional(),
  employmentStatus: z.string().max(80).optional(),
  socialStatus: z.string().max(120).optional(),
  languages: z.array(z.string().max(40)).max(20).optional(),
  digitalSkill: z.string().max(40).optional(),
  hobbies: z.string().max(500).optional(),
  happinessLevel: z.number().int().min(1).max(10).optional(),
  healthNotes: z.string().max(1000).optional(),
  specialNeeds: z.string().max(1000).optional(),
  hasCar: z.boolean().optional(),
  carModel: z.string().max(120).optional(),
  carPlate: z.string().max(20).optional(),
});

export async function mobileResidentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', mobileAuthGuard);

  // GET /api/mobile/residents/me
  app.get('/me', async (req, reply) => {
    const resident = await db.query.residents.findFirst({
      where: eq(residents.userId, req.authUser!.id),
    });
    return reply.send(ok(resident ?? null));
  });

  // ─── Self-reported address (separate modal) ─────────────────────────────────
  app.get('/me/address', async (req, reply) => {
    const row = await profileService.getAddress(req.authUser!.id);
    return reply.send(ok(row));
  });
  app.put('/me/address', async (req, reply) => {
    const body = addressSchema.parse(req.body);
    const row = await profileService.upsertAddress(req.authUser!.id, body);
    return reply.send(ok(row));
  });

  // ─── Additional ("extra") profile details (separate modal) ──────────────────
  app.get('/me/details', async (req, reply) => {
    const row = await profileService.getDetails(req.authUser!.id);
    return reply.send(ok(row));
  });
  app.put('/me/details', async (req, reply) => {
    const body = detailsSchema.parse(req.body);
    const row = await profileService.upsertDetails(req.authUser!.id, body);
    return reply.send(ok(row));
  });

  // PUT /api/mobile/residents/me
  app.put('/me', async (req, reply) => {
    const schema = z.object({
      mahallaId: z.string().uuid(),
      firstName: z.string().min(1).max(80),
      lastName: z.string().min(1).max(80),
      middleName: z.string().max(80).optional(),
      phone: z.string().max(32).optional(),
      birthDate: z.string().datetime().optional(),
      gender: z.enum(['male', 'female', 'other']).optional(),
    });
    const body = schema.parse(req.body);
    const existing = await db.query.residents.findFirst({ where: eq(residents.userId, req.authUser!.id) });

    if (existing) {
      const [updated] = await db.update(residents)
        .set({ ...body, birthDate: body.birthDate ? new Date(body.birthDate) : undefined, updatedAt: new Date() })
        .where(eq(residents.id, existing.id))
        .returning();
      return reply.send(ok(updated));
    }

    const [created] = await db.insert(residents).values({
      mahallaId: body.mahallaId,
      userId: req.authUser!.id,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName,
      phone: body.phone,
      birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      gender: body.gender,
    }).returning();
    return reply.status(201).send(ok(created));
  });

  // ─── Businesses ───────────────────────────────────────────────────────────

  // GET /me/businesses
  app.get('/me/businesses', async (req, reply) => {
    const items = await db
      .select({
        id: businesses.id,
        organizationId: businesses.organizationId,
        ownerUserId: businesses.ownerUserId,
        businessName: businesses.businessName,
        legalName: businesses.legalName,
        categoryId: businesses.categoryId,
        phone: businesses.phone,
        address: businesses.address,
        description: businesses.description,
        latitude: businesses.latitude,
        longitude: businesses.longitude,
        telegram: businesses.telegram,
        website: businesses.website,
        verificationStatus: businesses.verificationStatus,
        deletionRequestedAt: businesses.deletionRequestedAt,
        createdAt: businesses.createdAt,
        updatedAt: businesses.updatedAt,
        productCount: count(businessProducts.id),
      })
      .from(businesses)
      .leftJoin(businessProducts, eq(businessProducts.businessId, businesses.id))
      .where(eq(businesses.ownerUserId, req.authUser!.id))
      .groupBy(businesses.id);
    return reply.send(ok(items));
  });

  // POST /me/business
  app.post('/me/business', { preHandler: [mobileTenantContext] }, async (req, reply) => {
    const schema = z.object({
      businessName: z.string().min(2).max(200),
      legalName: z.string().max(200).optional(),
      categoryId: z.string().uuid().optional(),
      phone: z.string().max(32).optional(),
      address: z.string().max(500).optional(),
      description: z.string().max(2000).optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      telegram: z.string().max(100).optional(),
      website: z.string().url().optional(),
    });
    const body = schema.parse(req.body);
    const orgId = req.organizationId;
    if (!orgId) return reply.status(400).send({ status: 'error', message: 'X-Mahalla-Id header talab qilinadi' });

    const [business] = await db.insert(businesses).values({
      organizationId: orgId,
      ownerUserId: req.authUser!.id,
      ...body,
      verificationStatus: 'PENDING',
    }).returning();
    return reply.status(201).send(ok(business));
  });

  // GET /me/business/:id
  app.get('/me/business/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [business] = await db.select().from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, req.authUser!.id)));
    if (!business) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    const workingHours = await db.select().from(businessWorkingHours)
      .where(eq(businessWorkingHours.businessId, id));
    return reply.send(ok({ ...business, workingHours }));
  });

  // PUT /me/business/:id
  app.put('/me/business/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const schema = z.object({
      businessName: z.string().min(2).max(200).optional(),
      legalName: z.string().max(200).optional().nullable(),
      categoryId: z.string().uuid().optional().nullable(),
      phone: z.string().max(32).optional().nullable(),
      additionalPhone: z.string().max(32).optional().nullable(),
      address: z.string().max(500).optional().nullable(),
      description: z.string().max(2000).optional().nullable(),
      telegram: z.string().max(100).optional().nullable(),
      website: z.string().url().optional().nullable(),
      latitude: z.number().optional().nullable(),
      longitude: z.number().optional().nullable(),
    });
    const body = schema.parse(req.body);
    const [existing] = await db.select({ id: businesses.id }).from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, req.authUser!.id)));
    if (!existing) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    const [updated] = await db.update(businesses)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(businesses.id, id))
      .returning();
    return reply.send(ok(updated));
  });

  // PUT /me/business/:id/working-hours
  app.put('/me/business/:id/working-hours', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { hours } = z.object({
      hours: z.array(z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
        isClosed: z.boolean().default(false),
      })),
    }).parse(req.body);
    const [existing] = await db.select({ id: businesses.id }).from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, req.authUser!.id)));
    if (!existing) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    await db.delete(businessWorkingHours).where(eq(businessWorkingHours.businessId, id));
    if (hours.length > 0) {
      await db.insert(businessWorkingHours).values(hours.map(h => ({ ...h, businessId: id })));
    }
    return reply.send(ok({ updated: true }));
  });

  // DELETE /me/business/:id
  app.delete('/me/business/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [business] = await db
      .select({ id: businesses.id, ownerUserId: businesses.ownerUserId, verificationStatus: businesses.verificationStatus })
      .from(businesses).where(eq(businesses.id, id));
    if (!business) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    if (business.ownerUserId !== req.authUser!.id && !req.authUser!.isPlatformAdmin) {
      return reply.status(403).send({ status: 'error', message: 'Ruxsat yo\'q' });
    }
    if (business.verificationStatus === 'APPROVED') {
      await db.update(businesses)
        .set({ deletionRequestedAt: new Date() })
        .where(eq(businesses.id, id));
      return reply.send(ok({ deleted: false, requested: true }));
    }
    await db.delete(businesses).where(eq(businesses.id, id));
    return reply.send(ok({ deleted: true, requested: false }));
  });

  // ─── Business Products ────────────────────────────────────────────────────

  // GET /me/business/:id/products
  app.get('/me/business/:id/products', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [biz] = await db.select({ id: businesses.id }).from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, req.authUser!.id)));
    if (!biz) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    const products = await bizService.listProducts(id); // includes images[]
    return reply.send(ok(products));
  });

  // POST /me/business/:id/products
  app.post('/me/business/:id/products', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional().nullable(),
      image: z.string().optional().nullable(),
      images: z.array(z.string()).max(10).optional(),
      price: z.string().max(20).optional().nullable(),
      unit: z.string().max(50).optional().nullable(),
      sectionId: z.string().uuid().nullable().optional(),
      portion: z.string().max(50).optional().nullable(),
      stock: z.number().int().optional().nullable(),
      isAvailable: z.boolean().default(true),
    });
    const body = schema.parse(req.body);
    const [biz] = await db.select({ id: businesses.id }).from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, req.authUser!.id)));
    if (!biz) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    const product = await bizService.createProduct(id, {
      title: body.title,
      description: body.description ?? undefined,
      image: body.image ?? undefined,
      images: body.images,
      price: body.price ?? undefined,
      unit: body.unit ?? undefined,
      sectionId: body.sectionId ?? undefined,
      portion: body.portion ?? undefined,
      stock: body.stock ?? undefined,
      isAvailable: body.isAvailable,
    });
    return reply.status(201).send(ok(product));
  });

  // PUT /me/business/:id/products/:productId
  app.put('/me/business/:id/products/:productId', async (req, reply) => {
    const { id, productId } = z.object({ id: z.string().uuid(), productId: z.string().uuid() }).parse(req.params);
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional().nullable(),
      image: z.string().optional().nullable(),
      price: z.string().max(20).optional().nullable(),
      unit: z.string().max(50).optional().nullable(),
      sectionId: z.string().uuid().nullable().optional(),
      portion: z.string().max(50).optional().nullable(),
      stock: z.number().int().optional().nullable(),
      isAvailable: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const [biz] = await db.select({ id: businesses.id }).from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, req.authUser!.id)));
    if (!biz) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    const [updated] = await db.update(businessProducts)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(businessProducts.id, productId), eq(businessProducts.businessId, id)))
      .returning();
    if (!updated) return reply.status(404).send({ status: 'error', message: 'Mahsulot topilmadi' });
    return reply.send(ok(updated));
  });

  // DELETE /me/business/:id/products/:productId
  app.delete('/me/business/:id/products/:productId', async (req, reply) => {
    const { id, productId } = z.object({ id: z.string().uuid(), productId: z.string().uuid() }).parse(req.params);
    const [biz] = await db.select({ id: businesses.id }).from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, req.authUser!.id)));
    if (!biz) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    await db.delete(businessProducts)
      .where(and(eq(businessProducts.id, productId), eq(businessProducts.businessId, id)));
    return reply.send(ok({ deleted: true }));
  });

  // ─── Product images (multiple) ──────────────────────────────────────────────
  async function ownsBusiness(req: any, id: string): Promise<boolean> {
    const [biz] = await db.select({ id: businesses.id }).from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, req.authUser!.id)));
    return !!biz;
  }

  // POST /me/business/:id/products/:productId/images  { url }
  app.post('/me/business/:id/products/:productId/images', async (req, reply) => {
    const { id, productId } = z.object({ id: z.string().uuid(), productId: z.string().uuid() }).parse(req.params);
    const { url } = z.object({ url: z.string().min(1) }).parse(req.body);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    const img = await bizService.addProductImage(id, productId, url);
    return reply.status(201).send(ok(img));
  });

  // DELETE /me/business/:id/products/:productId/images/:imageId
  app.delete('/me/business/:id/products/:productId/images/:imageId', async (req, reply) => {
    const { id, productId, imageId } = z.object({
      id: z.string().uuid(), productId: z.string().uuid(), imageId: z.string().uuid(),
    }).parse(req.params);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    await bizService.deleteProductImage(id, productId, imageId);
    return reply.send(ok({ deleted: true }));
  });

  // PUT /me/business/:id/products/:productId/images/order  { ids }
  app.put('/me/business/:id/products/:productId/images/order', async (req, reply) => {
    const { id, productId } = z.object({ id: z.string().uuid(), productId: z.string().uuid() }).parse(req.params);
    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(req.body);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    await bizService.reorderProductImages(id, productId, ids);
    return reply.send(ok({ reordered: true }));
  });

  // ─── Menu sections (food) ─────────────────────────────────────────────────
  const bizParam = z.object({ id: z.string().uuid() });

  app.get('/me/business/:id/menu-sections', async (req, reply) => {
    const { id } = bizParam.parse(req.params);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.send(ok(await bizService.listMenuSections(id)));
  });
  app.post('/me/business/:id/menu-sections', async (req, reply) => {
    const { id } = bizParam.parse(req.params);
    const body = z.object({ name: z.string().min(1).max(100), sortOrder: z.number().int().optional() }).parse(req.body);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.status(201).send(ok(await bizService.createMenuSection(id, body)));
  });
  app.put('/me/business/:id/menu-sections/:sid', async (req, reply) => {
    const { id, sid } = z.object({ id: z.string().uuid(), sid: z.string().uuid() }).parse(req.params);
    const body = z.object({ name: z.string().min(1).max(100).optional(), sortOrder: z.number().int().optional() }).parse(req.body);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.send(ok(await bizService.updateMenuSection(id, sid, body)));
  });
  app.delete('/me/business/:id/menu-sections/:sid', async (req, reply) => {
    const { id, sid } = z.object({ id: z.string().uuid(), sid: z.string().uuid() }).parse(req.params);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    await bizService.deleteMenuSection(id, sid);
    return reply.send(ok({ deleted: true }));
  });

  // ─── Reservation settings + resources (owner) ──────────────────────────────
  app.get('/me/business/:id/reservation-settings', async (req, reply) => {
    const { id } = bizParam.parse(req.params);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.send(ok(await bizService.getReservationSettings(id)));
  });
  app.put('/me/business/:id/reservation-settings', async (req, reply) => {
    const { id } = bizParam.parse(req.params);
    const body = z.object({
      enabled: z.boolean().optional(),
      slotMinutes: z.number().int().min(15).max(480).optional(),
      partySizeMax: z.number().int().min(1).max(100).nullable().optional(),
      leadMinMinutes: z.number().int().min(0).optional(),
      note: z.string().max(500).nullable().optional(),
    }).parse(req.body);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.send(ok(await bizService.upsertReservationSettings(id, body)));
  });

  app.get('/me/business/:id/resources', async (req, reply) => {
    const { id } = bizParam.parse(req.params);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.send(ok(await bizService.listResources(id)));
  });
  app.post('/me/business/:id/resources', async (req, reply) => {
    const { id } = bizParam.parse(req.params);
    const body = z.object({ name: z.string().min(1).max(100), capacity: z.number().int().min(1).max(100).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() }).parse(req.body);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.status(201).send(ok(await bizService.createResource(id, body)));
  });
  app.put('/me/business/:id/resources/:rid', async (req, reply) => {
    const { id, rid } = z.object({ id: z.string().uuid(), rid: z.string().uuid() }).parse(req.params);
    const body = z.object({ name: z.string().min(1).max(100).optional(), capacity: z.number().int().min(1).max(100).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() }).parse(req.body);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.send(ok(await bizService.updateResource(id, rid, body)));
  });
  app.delete('/me/business/:id/resources/:rid', async (req, reply) => {
    const { id, rid } = z.object({ id: z.string().uuid(), rid: z.string().uuid() }).parse(req.params);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    await bizService.deleteResource(id, rid);
    return reply.send(ok({ deleted: true }));
  });

  // ─── Reservations (owner view + status) ────────────────────────────────────
  app.get('/me/business/:id/reservations', async (req, reply) => {
    const { id } = bizParam.parse(req.params);
    const { date } = z.object({ date: z.string().optional() }).parse(req.query);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.send(ok(await bizService.listReservations(id, date)));
  });
  app.patch('/me/business/:id/reservations/:rid', async (req, reply) => {
    const { id, rid } = z.object({ id: z.string().uuid(), rid: z.string().uuid() }).parse(req.params);
    const { status } = z.object({ status: z.enum(['pending', 'confirmed', 'cancelled', 'seated', 'no_show', 'completed']) }).parse(req.body);
    if (!(await ownsBusiness(req, id))) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    return reply.send(ok(await bizService.updateReservationStatus(id, rid, status)));
  });

  // ─── My reservations (resident) ────────────────────────────────────────────
  app.get('/me/reservations', async (req, reply) => {
    const rows = await db
      .select({
        id: businessReservations.id,
        businessId: businessReservations.businessId,
        businessName: businesses.businessName,
        resourceId: businessReservations.resourceId,
        startsAt: businessReservations.startsAt,
        partySize: businessReservations.partySize,
        status: businessReservations.status,
        contactName: businessReservations.contactName,
        contactPhone: businessReservations.contactPhone,
        note: businessReservations.note,
        createdAt: businessReservations.createdAt,
      })
      .from(businessReservations)
      .leftJoin(businesses, eq(businesses.id, businessReservations.businessId))
      .where(eq(businessReservations.residentId, req.authUser!.id))
      .orderBy(desc(businessReservations.startsAt));
    return reply.send(ok(rows));
  });

  // ─── Services ─────────────────────────────────────────────────────────────

  // GET /me/services
  app.get('/me/services', async (req, reply) => {
    const items = await db.select().from(serviceProviders)
      .where(eq(serviceProviders.userId, req.authUser!.id));
    return reply.send(ok(items));
  });

  // POST /me/service
  app.post('/me/service', { preHandler: [mobileTenantContext] }, async (req, reply) => {
    const schema = z.object({
      businessName: z.string().min(2).max(200),
      phone: z.string().max(32).optional(),
      telegram: z.string().max(100).optional(),
      description: z.string().max(2000).optional(),
      experienceYears: z.number().min(0).max(50).optional(),
      categoryIds: z.array(z.string().uuid()).optional(),
    });
    const body = schema.parse(req.body);
    const orgId = req.organizationId;
    if (!orgId) return reply.status(400).send({ status: 'error', message: 'X-Mahalla-Id header talab qilinadi' });

    const [provider] = await db.insert(serviceProviders).values({
      organizationId: orgId,
      userId: req.authUser!.id,
      businessName: body.businessName,
      phone: body.phone ?? '',
      telegram: body.telegram,
      description: body.description,
      experienceYears: body.experienceYears ?? 0,
      verificationStatus: 'PENDING',
    }).returning();

    if (body.categoryIds && body.categoryIds.length > 0) {
      await db.insert(providerServices).values(
        body.categoryIds.map(catId => ({
          providerId: provider.id,
          categoryId: catId,
          serviceName: body.businessName,
        }))
      );
    }

    return reply.status(201).send(ok(provider));
  });

  // GET /me/service/:id
  app.get('/me/service/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [provider] = await db.select().from(serviceProviders)
      .where(and(eq(serviceProviders.id, id), eq(serviceProviders.userId, req.authUser!.id)));
    if (!provider) return reply.status(404).send({ status: 'error', message: 'Xizmat topilmadi' });
    const categories = await db.select().from(providerServices)
      .where(eq(providerServices.providerId, id));
    return reply.send(ok({ ...provider, categories }));
  });

  // PUT /me/service/:id
  app.put('/me/service/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const schema = z.object({
      businessName: z.string().min(2).max(200).optional(),
      phone: z.string().max(32).optional().nullable(),
      telegram: z.string().max(100).optional().nullable(),
      description: z.string().max(2000).optional().nullable(),
      experienceYears: z.number().min(0).max(50).optional(),
      isAvailable: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const [existing] = await db.select({ id: serviceProviders.id }).from(serviceProviders)
      .where(and(eq(serviceProviders.id, id), eq(serviceProviders.userId, req.authUser!.id)));
    if (!existing) return reply.status(404).send({ status: 'error', message: 'Xizmat topilmadi' });
    const [updated] = await db.update(serviceProviders)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(serviceProviders.id, id))
      .returning();
    return reply.send(ok(updated));
  });

  // DELETE /me/service/:id
  app.delete('/me/service/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [provider] = await db
      .select({ id: serviceProviders.id, userId: serviceProviders.userId, verificationStatus: serviceProviders.verificationStatus })
      .from(serviceProviders).where(eq(serviceProviders.id, id));
    if (!provider) return reply.status(404).send({ status: 'error', message: 'Xizmat topilmadi' });
    if (provider.userId !== req.authUser!.id && !req.authUser!.isPlatformAdmin) {
      return reply.status(403).send({ status: 'error', message: 'Ruxsat yo\'q' });
    }
    if (provider.verificationStatus === 'APPROVED') {
      await db.update(serviceProviders)
        .set({ deletionRequestedAt: new Date() })
        .where(eq(serviceProviders.id, id));
      return reply.send(ok({ deleted: false, requested: true }));
    }
    await db.delete(serviceProviders).where(eq(serviceProviders.id, id));
    return reply.send(ok({ deleted: true, requested: false }));
  });
}
