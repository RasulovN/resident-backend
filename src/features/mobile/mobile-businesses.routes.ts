import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { ok } from '../../common/utils/response';
import { mobileTenantContext, mobileAuthOptional, mobileAuthGuard } from '../../common/middleware/mobile-auth';
import {
  businesses,
  businessCategories,
  businessReviews,
  businessGallery,
  businessServices,
  businessProducts,
  businessCallLogs,
  businessFavorites,
  businessWorkingHours,
  businessMenuSections,
  businessReservationSettings,
  businessResources,
} from '../businesses/businesses.model';
import * as bizService from '../businesses/businesses.service';
import { computeIsOpen, type DbWorkingHour } from '../businesses/business-hours';

/**
 * Attach a live `isOpen` flag to a list of businesses from their working hours.
 * `isOpen` is `null` when the business has no hours configured ("status unknown")
 * — distinct from `false` ("currently closed") so the UI doesn't mislabel a
 * business that simply never set its hours as closed.
 */
async function withOpenStatus<T extends { id: string }>(rows: T[]): Promise<(T & { isOpen: boolean | null })[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const hours = await db
    .select()
    .from(businessWorkingHours)
    .where(inArray(businessWorkingHours.businessId, ids));

  const byBusiness = new Map<string, DbWorkingHour[]>();
  for (const h of hours) {
    const list = byBusiness.get(h.businessId) ?? [];
    list.push(h);
    byBusiness.set(h.businessId, list);
  }

  const now = new Date();
  return rows.map((r) => {
    const hrs = byBusiness.get(r.id) ?? [];
    return { ...r, isOpen: hrs.length === 0 ? null : computeIsOpen(hrs, now) };
  });
}

export async function mobileBusinessRoutes(app: FastifyInstance) {
  app.addHook('preHandler', mobileTenantContext);

  // GET /api/mobile/businesses/categories
  app.get('/categories', async (req, reply) => {
    const orgId = req.organizationId;
    const rows = await db
      .select()
      .from(businessCategories)
      .where(
        and(
          eq(businessCategories.isActive, true),
          // Include this mahalla's own categories AND the shared global defaults.
          orgId
            ? or(
                eq(businessCategories.organizationId, orgId),
                isNull(businessCategories.organizationId),
              )
            : undefined,
        ),
      )
      .orderBy(businessCategories.sortOrder);
    // A mahalla's own category shadows the global default with the same slug.
    const ownSlugs = new Set(rows.filter((r) => r.organizationId).map((r) => r.slug));
    const cats = rows.filter((r) => r.organizationId || !ownSlugs.has(r.slug));
    return reply.send(ok(cats));
  });

  // GET /api/mobile/businesses
  app.get('/', async (req, reply) => {
    const { page, limit, categoryId, search } = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
      categoryId: z.string().uuid().optional(),
      search: z.string().optional(),
    }).parse(req.query);

    const orgId = req.organizationId;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof and>[] = [eq(businesses.verificationStatus, 'APPROVED')];
    if (orgId) conditions.push(eq(businesses.organizationId, orgId));
    if (categoryId) conditions.push(eq(businesses.categoryId, categoryId));
    if (search) conditions.push(or(
      ilike(businesses.businessName, `%${search}%`),
      ilike(businesses.description, `%${search}%`),
    )!);

    const items = await db
      .select({
        id: businesses.id,
        organizationId: businesses.organizationId,
        businessName: businesses.businessName,
        categoryId: businesses.categoryId,
        phone: businesses.phone,
        address: businesses.address,
        latitude: businesses.latitude,
        longitude: businesses.longitude,
        logoUrl: businesses.logo,
        coverUrl: businesses.coverImage,
        averageRating: businesses.averageRating,
        totalReviews: businesses.totalReviews,
        verificationStatus: businesses.verificationStatus,
        status: businesses.status,
      })
      .from(businesses)
      .where(and(...conditions))
      .orderBy(businesses.averageRating)
      .limit(limit)
      .offset(offset);

    return reply.send(ok({ items: await withOpenStatus(items), page, limit }));
  });

  // GET /api/mobile/businesses/favorites — list my favorite businesses (auth required)
  app.get('/favorites', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const userId = req.authUser!.id;
    const rows = await db
      .select({
        id:               businesses.id,
        businessName:     businesses.businessName,
        address:          businesses.address,
        logoUrl:          businesses.logo,
        coverUrl:         businesses.coverImage,
        phone:            businesses.phone,
        averageRating:    businesses.averageRating,
        totalReviews:     businesses.totalReviews,
        latitude:         businesses.latitude,
        longitude:        businesses.longitude,
        verificationStatus: businesses.verificationStatus,
        status:           businesses.status,
        categoryId:       businesses.categoryId,
      })
      .from(businessFavorites)
      .innerJoin(businesses, eq(businessFavorites.businessId, businesses.id))
      .where(eq(businessFavorites.residentId, userId))
      .orderBy(businessFavorites.createdAt);
    return reply.send(ok(await withOpenStatus(rows)));
  });

  // POST /api/mobile/businesses/:id/favorite — add to favorites
  app.post('/:id/favorite', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = req.authUser!.id;
    await db
      .insert(businessFavorites)
      .values({ businessId: id, residentId: userId })
      .onConflictDoNothing();
    return reply.send(ok({ favorited: true }));
  });

  // DELETE /api/mobile/businesses/:id/favorite — remove from favorites
  app.delete('/:id/favorite', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = req.authUser!.id;
    await db
      .delete(businessFavorites)
      .where(and(eq(businessFavorites.businessId, id), eq(businessFavorites.residentId, userId)));
    return reply.send(ok({ favorited: false }));
  });

  // GET /api/mobile/businesses/:id
  app.get('/:id', { preHandler: mobileAuthOptional }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const [business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, id), eq(businesses.verificationStatus, 'APPROVED')));

    if (!business) {
      return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });
    }

    const [gallery, services, productRows, workingHours, menuSections, resvSettings, resources] = await Promise.all([
      db.select().from(businessGallery).where(eq(businessGallery.businessId, id)),
      db.select().from(businessServices).where(eq(businessServices.businessId, id)),
      db.select().from(businessProducts).where(eq(businessProducts.businessId, id)),
      db.select().from(businessWorkingHours).where(eq(businessWorkingHours.businessId, id)),
      db.select().from(businessMenuSections).where(eq(businessMenuSections.businessId, id)),
      db.select().from(businessReservationSettings).where(eq(businessReservationSettings.businessId, id)),
      db.select().from(businessResources).where(and(eq(businessResources.businessId, id), eq(businessResources.isActive, true))),
    ]);
    const products = await bizService.attachProductImages(productRows);

    // Business kind from its category.
    let kind = 'other';
    if (business.categoryId) {
      const [cat] = await db.select({ kind: businessCategories.kind }).from(businessCategories).where(eq(businessCategories.id, business.categoryId));
      kind = cat?.kind ?? 'other';
    }

    // Check if favorited (only if user is logged in)
    let isFavorited = false;
    if (req.authUser?.id) {
      const [fav] = await db
        .select({ id: businessFavorites.id })
        .from(businessFavorites)
        .where(and(
          eq(businessFavorites.businessId, id),
          eq(businessFavorites.residentId, req.authUser.id),
        ));
      isFavorited = !!fav;
    }

    // null = hours not configured (unknown), not "closed".
    const isOpen = workingHours.length === 0 ? null : computeIsOpen(workingHours as DbWorkingHour[]);
    return reply.send(ok({
      ...business, kind, gallery, services, products, workingHours,
      menuSections, reservation: resvSettings[0] ?? null, resources,
      isFavorited, isOpen,
    }));
  });

  // GET /api/mobile/businesses/:id/availability?date=&partySize=
  app.get('/:id/availability', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { date, partySize } = z.object({
      date: z.string(),
      partySize: z.coerce.number().int().min(1).max(100).default(1),
    }).parse(req.query);
    const result = await bizService.getAvailability(id, date, partySize);
    return reply.send(ok(result));
  });

  // POST /api/mobile/businesses/:id/reservations — resident books
  app.post('/:id/reservations', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      startsAt: z.string(),
      partySize: z.number().int().min(1).max(100).default(1),
      resourceId: z.string().uuid().nullable().optional(),
      contactName: z.string().max(120).optional(),
      contactPhone: z.string().max(32).optional(),
      note: z.string().max(500).optional(),
    }).parse(req.body);
    const created = await bizService.createReservation(id, req.authUser!.id, body);
    return reply.status(201).send(ok(created));
  });

  // GET /api/mobile/businesses/:id/reviews
  app.get('/:id/reviews', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { page, limit } = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(10),
    }).parse(req.query);

    const items = await db
      .select()
      .from(businessReviews)
      .where(and(eq(businessReviews.businessId, id), eq(businessReviews.isHidden, false)))
      .limit(limit)
      .offset((page - 1) * limit);

    return reply.send(ok({ items, page, limit }));
  });

  // POST /api/mobile/businesses/:id/call
  app.post('/:id/call', { preHandler: mobileAuthOptional }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await db.insert(businessCallLogs).values({
      businessId: id,
      residentId: req.authUser?.id ?? null,
    });
    return reply.send(ok({ logged: true }));
  });

  // GET /api/mobile/businesses/top-rated
  app.get('/top-rated', async (req, reply) => {
    const orgId = req.organizationId;
    const conditions: ReturnType<typeof and>[] = [eq(businesses.verificationStatus, 'APPROVED')];
    if (orgId) conditions.push(eq(businesses.organizationId, orgId));

    const items = await db
      .select()
      .from(businesses)
      .where(and(...conditions))
      .orderBy(businesses.averageRating)
      .limit(10);

    return reply.send(ok(await withOpenStatus(items)));
  });

  // DELETE /api/mobile/businesses/:id — mahalla admin or platform admin deletes a business
  app.delete('/:id', { preHandler: [mobileAuthGuard] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
    if (!business) return reply.status(404).send({ status: 'error', message: 'Biznes topilmadi' });

    const orgId = req.organizationId;
    const canDelete = req.authUser!.isPlatformAdmin ||
      (orgId && business.organizationId === orgId);

    if (!canDelete) return reply.status(403).send({ status: 'error', message: 'Ruxsat yo\'q' });

    await db.delete(businesses).where(eq(businesses.id, id));
    return reply.send(ok({ deleted: true }));
  });
}
