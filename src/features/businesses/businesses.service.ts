import { and, asc, avg, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { createNotification, sendNotification } from '../notifications/notifications.service';
import { users } from '../users/users.model';
import {
  businessCategories,
  businesses,
  businessWorkingHours,
  businessDocuments,
  businessGallery,
  businessServices,
  businessProducts,
  businessProductImages,
  businessMenuSections,
  businessReservationSettings,
  businessResources,
  businessReservations,
  businessReviews,
  businessCallLogs,
  type BusinessCategory,
  type Business,
} from './businesses.model';
import type {
  CreateBusinessCategoryInput,
  UpdateBusinessCategoryInput,
  CreateBusinessInput,
  UpdateBusinessInput,
  VerifyBusinessInput,
  BusinessListQuery,
  CreateBusinessProductInput,
  CreateBusinessServiceInput,
  UpdateWorkingHoursInput,
} from './businesses.schema';

// ── Categories ──────────────────────────────────────────────────────────────

export async function listCategories(organizationId: string): Promise<BusinessCategory[]> {
  const rows = await db
    .select()
    .from(businessCategories)
    .where(
      or(
        eq(businessCategories.organizationId, organizationId),
        sql`${businessCategories.organizationId} IS NULL`,
      ),
    )
    .orderBy(businessCategories.sortOrder, businessCategories.name);
  // A mahalla's own category shadows the shared global default with the same slug.
  const ownSlugs = new Set(rows.filter((r) => r.organizationId).map((r) => r.slug));
  return rows.filter((r) => r.organizationId || !ownSlugs.has(r.slug));
}

export async function createCategory(
  organizationId: string,
  input: CreateBusinessCategoryInput,
): Promise<BusinessCategory> {
  const [created] = await db
    .insert(businessCategories)
    .values({ organizationId, ...input })
    .returning();
  return created!;
}

export async function updateCategory(
  organizationId: string,
  id: string,
  input: UpdateBusinessCategoryInput,
): Promise<BusinessCategory> {
  const [updated] = await db
    .update(businessCategories)
    .set({ ...input })
    .where(and(eq(businessCategories.id, id), eq(businessCategories.organizationId, organizationId)))
    .returning();
  if (!updated) throw AppError.notFound('Business category not found');
  return updated;
}

export async function deleteCategory(organizationId: string, id: string): Promise<void> {
  const [deleted] = await db
    .delete(businessCategories)
    .where(and(eq(businessCategories.id, id), eq(businessCategories.organizationId, organizationId)))
    .returning({ id: businessCategories.id });
  if (!deleted) throw AppError.notFound('Business category not found');
}

export async function seedDefaultCategories(organizationId: string): Promise<void> {
  const defaults = [
    { name: 'Oziq-ovqat do\'koni',    slug: 'grocery',          icon: '🛒', kind: 'retail'  as const, sortOrder: 1 },
    { name: 'Mini Market',             slug: 'mini-market',      icon: '🏪', kind: 'retail'  as const, sortOrder: 2 },
    { name: 'Restoran',                slug: 'restaurant',       icon: '🍽️', kind: 'food'    as const, sortOrder: 3 },
    { name: 'Kafe',                    slug: 'cafe',             icon: '☕', kind: 'food'    as const, sortOrder: 4 },
    { name: 'Non zavodi / Bakery',     slug: 'bakery',           icon: '🥐', kind: 'food'    as const, sortOrder: 5 },
    { name: 'Dorixona',                slug: 'pharmacy',         icon: '💊', kind: 'retail'  as const, sortOrder: 6 },
    { name: 'Go\'zallik saloni',       slug: 'beauty-salon',     icon: '💅', kind: 'service' as const, sortOrder: 7 },
    { name: 'Sartaroshxona',           slug: 'barbershop',       icon: '✂️', kind: 'service' as const, sortOrder: 8 },
    { name: 'Spa / Massaj',            slug: 'spa',              icon: '🧖', kind: 'service' as const, sortOrder: 9 },
    { name: 'Bolalar bog\'chasi',      slug: 'kindergarten',     icon: '🏫', kind: 'service' as const, sortOrder: 10 },
    { name: 'Maktab',                  slug: 'school',           icon: '📚', kind: 'service' as const, sortOrder: 11 },
    { name: 'O\'quv markazi',          slug: 'training-center',  icon: '🎓', kind: 'service' as const, sortOrder: 12 },
    { name: 'Fitness Markaz',          slug: 'fitness-center',   icon: '🏋️', kind: 'service' as const, sortOrder: 13 },
    { name: 'Klinika',                 slug: 'clinic',           icon: '🏥', kind: 'service' as const, sortOrder: 14 },
    { name: 'Tish shifoxonasi',        slug: 'dental',           icon: '🦷', kind: 'service' as const, sortOrder: 15 },
    { name: 'Elektronika',             slug: 'electronics',      icon: '📱', kind: 'retail'  as const, sortOrder: 16 },
    { name: 'Uy xizmatlari',           slug: 'home-service',     icon: '🔧', kind: 'service' as const, sortOrder: 17 },
    { name: 'Qurilish',                slug: 'construction',     icon: '🏗️', kind: 'service' as const, sortOrder: 18 },
    { name: 'Avto xizmat',             slug: 'auto-service',     icon: '🚗', kind: 'service' as const, sortOrder: 19 },
    { name: 'Mehmonxona',              slug: 'hotel',            icon: '🏨', kind: 'venue'   as const, sortOrder: 20 },
    { name: 'Kimyoviy tozalash',       slug: 'laundry',          icon: '👕', kind: 'service' as const, sortOrder: 21 },
    { name: 'Tikuvchilik',             slug: 'tailoring',        icon: '🧵', kind: 'service' as const, sortOrder: 22 },
    { name: 'Uy ovqati',               slug: 'home-food',        icon: '🍱', kind: 'food'    as const, sortOrder: 23 },
    { name: 'Hunarmandchilik',         slug: 'handmade',         icon: '🎨', kind: 'service' as const, sortOrder: 24 },
    { name: 'Boshqa',                  slug: 'other',            icon: '📦', kind: 'other'   as const, sortOrder: 25 },
  ];

  // Add the standards as this mahalla's own categories — only the ones it
  // doesn't already have (idempotent; slug has no DB unique constraint).
  const existing = await db
    .select({ slug: businessCategories.slug })
    .from(businessCategories)
    .where(eq(businessCategories.organizationId, organizationId));
  const have = new Set(existing.map((e) => e.slug));
  const missing = defaults.filter((d) => !have.has(d.slug));
  if (missing.length === 0) return;

  await db
    .insert(businessCategories)
    .values(missing.map((cat) => ({ organizationId, ...cat, isActive: true })));
}

// ── Businesses ───────────────────────────────────────────────────────────────

export async function listBusinesses(
  organizationId: string,
  query: BusinessListQuery,
) {
  const { page, limit, search, verificationStatus, categoryId, status } = query;
  const offset = getOffset({ page, limit });

  const conditions = [eq(businesses.organizationId, organizationId)];

  if (search) {
    conditions.push(
      or(
        ilike(businesses.businessName, `%${search}%`),
        ilike(businesses.legalName,    `%${search}%`),
        ilike(businesses.phone,        `%${search}%`),
        ilike(businesses.address,      `%${search}%`),
      )!,
    );
  }
  if (verificationStatus) {
    conditions.push(eq(businesses.verificationStatus, verificationStatus));
  }
  if (categoryId) {
    conditions.push(eq(businesses.categoryId, categoryId));
  }
  if (status) {
    conditions.push(eq(businesses.status, status));
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(businesses)
    .where(where);

  const rows = await db
    .select({
      business:  businesses,
      category:  { id: businessCategories.id, name: businessCategories.name, icon: businessCategories.icon },
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .where(where)
    .orderBy(desc(businesses.createdAt))
    .limit(limit)
    .offset(offset);

  return paginated(rows, countRow?.total ?? 0, { page, limit });
}

export async function getBusiness(organizationId: string, id: string) {
  const [row] = await db
    .select({
      business:  businesses,
      category:  { id: businessCategories.id, name: businessCategories.name, icon: businessCategories.icon, kind: businessCategories.kind },
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .where(and(eq(businesses.id, id), eq(businesses.organizationId, organizationId)));

  if (!row) throw AppError.notFound('Business not found');

  const hours = await db
    .select()
    .from(businessWorkingHours)
    .where(eq(businessWorkingHours.businessId, id));

  const docs = await db
    .select()
    .from(businessDocuments)
    .where(eq(businessDocuments.businessId, id));

  const gallery = await db
    .select()
    .from(businessGallery)
    .where(eq(businessGallery.businessId, id))
    .orderBy(businessGallery.sortOrder);

  const serviceItems = await db
    .select()
    .from(businessServices)
    .where(eq(businessServices.businessId, id));

  const productRows = await db
    .select()
    .from(businessProducts)
    .where(eq(businessProducts.businessId, id));
  const products = await attachProductImages(productRows);

  const menuSections = await db
    .select()
    .from(businessMenuSections)
    .where(eq(businessMenuSections.businessId, id))
    .orderBy(asc(businessMenuSections.sortOrder));

  const [reservationSettings] = await db
    .select()
    .from(businessReservationSettings)
    .where(eq(businessReservationSettings.businessId, id));

  const resources = await db
    .select()
    .from(businessResources)
    .where(and(eq(businessResources.businessId, id), eq(businessResources.isActive, true)))
    .orderBy(asc(businessResources.sortOrder));

  return {
    ...row.business,
    category: row.category,
    kind: (row.category as { kind?: string } | null)?.kind ?? 'other',
    hours,
    documents: docs,
    gallery,
    services: serviceItems,
    products,
    menuSections,
    reservation: reservationSettings ?? null,
    resources,
  };
}

export async function createBusiness(
  organizationId: string,
  ownerUserId: string | null,
  input: CreateBusinessInput,
): Promise<Business> {
  const [created] = await db
    .insert(businesses)
    .values({
      organizationId,
      ownerUserId,
      categoryId:            input.categoryId,
      businessName:          input.businessName,
      legalName:             input.legalName,
      phone:                 input.phone,
      additionalPhone:       input.additionalPhone,
      telegram:              input.telegram,
      website:               input.website,
      address:               input.address,
      latitude:              input.latitude,
      longitude:             input.longitude,
      description:           input.description,
      logo:                  input.logo,
      coverImage:            input.coverImage,
      onlineOrderingEnabled: input.onlineOrderingEnabled ?? false,
      verificationStatus:    'PENDING',
    })
    .returning();
  return created!;
}

export async function updateBusiness(
  organizationId: string,
  id: string,
  input: UpdateBusinessInput,
): Promise<Business> {
  const [updated] = await db
    .update(businesses)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(businesses.id, id), eq(businesses.organizationId, organizationId)))
    .returning();
  if (!updated) throw AppError.notFound('Business not found');
  return updated;
}

export async function verifyBusiness(
  organizationId: string,
  id: string,
  verifiedById: string,
  input: VerifyBusinessInput,
): Promise<Business> {
  const statusMap: Record<string, 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'CLOSED'> = {
    approve:      'APPROVED',
    reject:       'REJECTED',
    under_review: 'UNDER_REVIEW',
    suspend:      'SUSPENDED',
    close:        'CLOSED',
  };

  const [updated] = await db
    .update(businesses)
    .set({
      verificationStatus: statusMap[input.action],
      verifiedById:       input.action === 'approve' ? verifiedById : undefined,
      verifiedAt:         input.action === 'approve' ? new Date() : undefined,
      rejectionReason:    input.action === 'reject' ? input.rejectionReason : undefined,
      updatedAt:          new Date(),
    })
    .where(and(eq(businesses.id, id), eq(businesses.organizationId, organizationId)))
    .returning();
  if (!updated) throw AppError.notFound('Business not found');
  return updated;
}

export async function deleteBusiness(organizationId: string, id: string): Promise<void> {
  const [deleted] = await db
    .delete(businesses)
    .where(and(eq(businesses.id, id), eq(businesses.organizationId, organizationId)))
    .returning({ id: businesses.id });
  if (!deleted) throw AppError.notFound('Business not found');
}

// ── Working Hours ─────────────────────────────────────────────────────────────

export async function upsertWorkingHours(
  businessId: string,
  hours: UpdateWorkingHoursInput,
): Promise<void> {
  await db.delete(businessWorkingHours).where(eq(businessWorkingHours.businessId, businessId));
  if (hours.length > 0) {
    await db.insert(businessWorkingHours).values(
      hours.map((h) => ({ businessId, ...h })),
    );
  }
}

// ── Products ─────────────────────────────────────────────────────────────────

/** Attach `images: [{id,url,sortOrder}]` to each product row. */
export async function attachProductImages<T extends { id: string }>(products: T[]): Promise<(T & { images: Array<{ id: string; url: string; sortOrder: number }> })[]> {
  if (products.length === 0) return products as never;
  const ids = products.map((p) => p.id);
  const imgs = await db
    .select()
    .from(businessProductImages)
    .where(inArray(businessProductImages.productId, ids))
    .orderBy(asc(businessProductImages.sortOrder), asc(businessProductImages.createdAt));
  const byProduct = new Map<string, Array<{ id: string; url: string; sortOrder: number }>>();
  for (const im of imgs) {
    const arr = byProduct.get(im.productId) ?? [];
    arr.push({ id: im.id, url: im.url, sortOrder: im.sortOrder });
    byProduct.set(im.productId, arr);
  }
  return products.map((p) => ({ ...p, images: byProduct.get(p.id) ?? [] }));
}

export async function listProducts(businessId: string) {
  const products = await db.select().from(businessProducts).where(eq(businessProducts.businessId, businessId));
  return attachProductImages(products);
}

// Sync the legacy single `image` cover = first image.
async function syncProductCover(productId: string): Promise<void> {
  const [first] = await db
    .select({ url: businessProductImages.url })
    .from(businessProductImages)
    .where(eq(businessProductImages.productId, productId))
    .orderBy(asc(businessProductImages.sortOrder), asc(businessProductImages.createdAt))
    .limit(1);
  await db
    .update(businessProducts)
    .set({ image: first?.url ?? null, updatedAt: new Date() })
    .where(eq(businessProducts.id, productId));
}

export async function createProduct(
  businessId: string,
  input: CreateBusinessProductInput & { images?: string[] },
) {
  const { images, ...rest } = input;
  const cover = rest.image ?? images?.[0] ?? null;
  const [created] = await db
    .insert(businessProducts)
    .values({ businessId, ...rest, image: cover })
    .returning();
  if (images && images.length > 0) {
    await db.insert(businessProductImages).values(
      images.map((url, i) => ({ productId: created!.id, url, sortOrder: i })),
    );
    await syncProductCover(created!.id);
  }
  return created!;
}

export async function deleteProduct(businessId: string, productId: string): Promise<void> {
  const [deleted] = await db
    .delete(businessProducts)
    .where(and(eq(businessProducts.id, productId), eq(businessProducts.businessId, businessId)))
    .returning({ id: businessProducts.id });
  if (!deleted) throw AppError.notFound('Product not found');
}

// ── Product images (multiple) ──────────────────────────────────────────────

async function assertProductInBusiness(businessId: string, productId: string): Promise<void> {
  const [row] = await db
    .select({ id: businessProducts.id })
    .from(businessProducts)
    .where(and(eq(businessProducts.id, productId), eq(businessProducts.businessId, businessId)));
  if (!row) throw AppError.notFound('Product not found');
}

export async function addProductImage(businessId: string, productId: string, url: string) {
  await assertProductInBusiness(businessId, productId);
  const [{ value: max } = { value: -1 }] = await db
    .select({ value: sql<number>`coalesce(max(${businessProductImages.sortOrder}), -1)` })
    .from(businessProductImages)
    .where(eq(businessProductImages.productId, productId));
  const [created] = await db
    .insert(businessProductImages)
    .values({ productId, url, sortOrder: Number(max) + 1 })
    .returning();
  await syncProductCover(productId);
  return created!;
}

export async function deleteProductImage(businessId: string, productId: string, imageId: string): Promise<void> {
  await assertProductInBusiness(businessId, productId);
  await db
    .delete(businessProductImages)
    .where(and(eq(businessProductImages.id, imageId), eq(businessProductImages.productId, productId)));
  await syncProductCover(productId);
}

export async function reorderProductImages(businessId: string, productId: string, ids: string[]): Promise<void> {
  await assertProductInBusiness(businessId, productId);
  await Promise.all(
    ids.map((imageId, i) =>
      db
        .update(businessProductImages)
        .set({ sortOrder: i })
        .where(and(eq(businessProductImages.id, imageId), eq(businessProductImages.productId, productId))),
    ),
  );
  await syncProductCover(productId);
}

// ── Menu sections (food) ──────────────────────────────────────────────────────

export async function listMenuSections(businessId: string) {
  return db
    .select()
    .from(businessMenuSections)
    .where(eq(businessMenuSections.businessId, businessId))
    .orderBy(asc(businessMenuSections.sortOrder));
}

export async function createMenuSection(businessId: string, input: { name: string; sortOrder?: number }) {
  const [created] = await db
    .insert(businessMenuSections)
    .values({ businessId, name: input.name, sortOrder: input.sortOrder ?? 0 })
    .returning();
  return created!;
}

export async function updateMenuSection(businessId: string, sectionId: string, input: { name?: string; sortOrder?: number }) {
  const [updated] = await db
    .update(businessMenuSections)
    .set(input)
    .where(and(eq(businessMenuSections.id, sectionId), eq(businessMenuSections.businessId, businessId)))
    .returning();
  if (!updated) throw AppError.notFound('Section not found');
  return updated;
}

export async function deleteMenuSection(businessId: string, sectionId: string): Promise<void> {
  // Detach products in this section, then delete it.
  await db.update(businessProducts).set({ sectionId: null }).where(eq(businessProducts.sectionId, sectionId));
  const [deleted] = await db
    .delete(businessMenuSections)
    .where(and(eq(businessMenuSections.id, sectionId), eq(businessMenuSections.businessId, businessId)))
    .returning({ id: businessMenuSections.id });
  if (!deleted) throw AppError.notFound('Section not found');
}

// ── Reservations ──────────────────────────────────────────────────────────────

export async function getReservationSettings(businessId: string) {
  const [s] = await db
    .select()
    .from(businessReservationSettings)
    .where(eq(businessReservationSettings.businessId, businessId));
  return s ?? null;
}

export async function upsertReservationSettings(
  businessId: string,
  input: { enabled?: boolean; slotMinutes?: number; partySizeMax?: number | null; leadMinMinutes?: number; note?: string | null },
) {
  const [row] = await db
    .insert(businessReservationSettings)
    .values({ businessId, ...input })
    .onConflictDoUpdate({ target: businessReservationSettings.businessId, set: { ...input } })
    .returning();
  return row!;
}

export async function listResources(businessId: string) {
  return db
    .select()
    .from(businessResources)
    .where(eq(businessResources.businessId, businessId))
    .orderBy(asc(businessResources.sortOrder));
}

export async function createResource(businessId: string, input: { name: string; capacity?: number; isActive?: boolean; sortOrder?: number }) {
  const [created] = await db.insert(businessResources).values({ businessId, ...input }).returning();
  return created!;
}

export async function updateResource(businessId: string, resourceId: string, input: Partial<{ name: string; capacity: number; isActive: boolean; sortOrder: number }>) {
  const [updated] = await db
    .update(businessResources)
    .set(input)
    .where(and(eq(businessResources.id, resourceId), eq(businessResources.businessId, businessId)))
    .returning();
  if (!updated) throw AppError.notFound('Resource not found');
  return updated;
}

export async function deleteResource(businessId: string, resourceId: string): Promise<void> {
  const [deleted] = await db
    .delete(businessResources)
    .where(and(eq(businessResources.id, resourceId), eq(businessResources.businessId, businessId)))
    .returning({ id: businessResources.id });
  if (!deleted) throw AppError.notFound('Resource not found');
}

const ACTIVE_RES_STATUSES = ['pending', 'confirmed', 'seated'] as const;

export async function listReservations(businessId: string, date?: string) {
  const conds = [eq(businessReservations.businessId, businessId)];
  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59.999`);
    conds.push(sql`${businessReservations.startsAt} >= ${start} AND ${businessReservations.startsAt} <= ${end}`);
  }
  return db
    .select()
    .from(businessReservations)
    .where(and(...conds))
    .orderBy(asc(businessReservations.startsAt));
}

export async function createReservation(
  businessId: string,
  residentId: string | null,
  input: { startsAt: string; partySize?: number; resourceId?: string | null; contactName?: string; contactPhone?: string; note?: string },
) {
  const settings = await getReservationSettings(businessId);
  if (!settings || !settings.enabled) throw AppError.badRequest('Reservations are not enabled for this business');
  const [created] = await db
    .insert(businessReservations)
    .values({
      businessId,
      residentId,
      resourceId: input.resourceId ?? null,
      startsAt: new Date(input.startsAt),
      partySize: input.partySize ?? 1,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      note: input.note,
      status: 'pending',
    })
    .returning();

  // Notify the business owner about the new booking (best-effort — never block the booking).
  await notifyOwnerOfReservation(businessId, created!, residentId);

  return created!;
}

/** Best-effort push/in-app notification to a business owner when a resident books. */
async function notifyOwnerOfReservation(
  businessId: string,
  reservation: { id: string; startsAt: Date; partySize: number; contactName?: string | null },
  residentId: string | null,
): Promise<void> {
  try {
    const [biz] = await db
      .select({
        ownerUserId: businesses.ownerUserId,
        organizationId: businesses.organizationId,
        businessName: businesses.businessName,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId));
    if (!biz?.ownerUserId) return;

    const when = reservation.startsAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    const whenLabel = `${pad(when.getDate())}.${pad(when.getMonth() + 1)} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
    const who = reservation.contactName?.trim() || 'Mijoz';

    const notif = await createNotification(
      {
        title: `Yangi bron — ${biz.businessName}`,
        body: `${who} ${whenLabel} ga ${reservation.partySize} kishiga bron qildi.`,
        type: 'BUSINESS',
        channel: 'MAHALLA',
        targetType: 'SPECIFIC_USERS',
        targetUserIds: [biz.ownerUserId],
        deepLink: `/business/reservations/${businessId}`,
      },
      residentId ?? biz.ownerUserId,
      biz.organizationId,
    );
    await sendNotification(notif.id);
  } catch {
    // Best-effort: a failed notification must not fail the reservation.
  }
}

export async function updateReservationStatus(businessId: string, reservationId: string, status: string) {
  const [updated] = await db
    .update(businessReservations)
    .set({ status: status as never, updatedAt: new Date() })
    .where(and(eq(businessReservations.id, reservationId), eq(businessReservations.businessId, businessId)))
    .returning();
  if (!updated) throw AppError.notFound('Reservation not found');
  return updated;
}

/** Build the day's bookable slots and mark availability vs resource capacity. */
export async function getAvailability(businessId: string, date: string, partySize: number) {
  const settings = await getReservationSettings(businessId);
  if (!settings || !settings.enabled) return { enabled: false, slots: [] as Array<{ time: string; available: boolean }> };

  const day = new Date(`${date}T00:00:00`).getDay(); // 0 Sun … 6 Sat
  const [wh] = await db
    .select()
    .from(businessWorkingHours)
    .where(and(eq(businessWorkingHours.businessId, businessId), eq(businessWorkingHours.dayOfWeek, day)));
  if (!wh || wh.isClosed || !wh.openTime || !wh.closeTime) return { enabled: true, slots: [] };

  const toMin = (t: string) => { const [h = '0', m = '0'] = t.split(':'); return Number(h) * 60 + Number(m); };
  const openMin = toMin(wh.openTime);
  const closeMin = toMin(wh.closeTime);
  const step = settings.slotMinutes;

  // Total capacity across active resources (0 → unconstrained, just offer slots).
  const resources = await db
    .select({ capacity: businessResources.capacity })
    .from(businessResources)
    .where(and(eq(businessResources.businessId, businessId), eq(businessResources.isActive, true)));
  const totalCapacity = resources.reduce((s, r) => s + r.capacity, 0);

  // Existing active reservations that day → booked party size per slot start.
  const existing = await listReservations(businessId, date);
  const bookedAt = new Map<number, number>();
  for (const r of existing) {
    if (!ACTIVE_RES_STATUSES.includes(r.status as never)) continue;
    const d = new Date(r.startsAt);
    bookedAt.set(d.getHours() * 60 + d.getMinutes(), (bookedAt.get(d.getHours() * 60 + d.getMinutes()) ?? 0) + r.partySize);
  }

  const slots: Array<{ time: string; available: boolean }> = [];
  for (let m = openMin; m + step <= closeMin; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const booked = bookedAt.get(m) ?? 0;
    const available = totalCapacity === 0 ? true : booked + partySize <= totalCapacity;
    slots.push({ time: `${hh}:${mm}`, available });
  }
  return { enabled: true, slots };
}

// ── Service items ────────────────────────────────────────────────────────────

export async function createServiceItem(businessId: string, input: CreateBusinessServiceInput) {
  const [created] = await db
    .insert(businessServices)
    .values({ businessId, ...input })
    .returning();
  return created!;
}

export async function deleteServiceItem(businessId: string, serviceId: string): Promise<void> {
  const [deleted] = await db
    .delete(businessServices)
    .where(and(eq(businessServices.id, serviceId), eq(businessServices.businessId, businessId)))
    .returning({ id: businessServices.id });
  if (!deleted) throw AppError.notFound('Service item not found');
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function listReviews(
  organizationId: string,
  businessId: string | undefined,
  pagination: Pagination,
) {
  const offset = getOffset(pagination);

  const conditions = [];
  if (businessId) conditions.push(eq(businessReviews.businessId, businessId));

  const joinedConditions = [
    eq(businesses.organizationId, organizationId),
    ...conditions,
  ];

  const [countRow] = await db
    .select({ total: count() })
    .from(businessReviews)
    .innerJoin(businesses, eq(businessReviews.businessId, businesses.id))
    .where(and(...joinedConditions));

  const rows = await db
    .select({
      review:        businessReviews,
      businessName:  businesses.businessName,
      residentName:  sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(businessReviews)
    .innerJoin(businesses, eq(businessReviews.businessId, businesses.id))
    .leftJoin(users, eq(businessReviews.residentId, users.id))
    .where(and(...joinedConditions))
    .orderBy(desc(businessReviews.createdAt))
    .limit(pagination.limit)
    .offset(offset);

  return paginated(rows, countRow?.total ?? 0, pagination);
}

export async function hideReview(id: string, organizationId: string) {
  // Verify ownership first
  const [review] = await db
    .select({ id: businessReviews.id })
    .from(businessReviews)
    .innerJoin(businesses, eq(businessReviews.businessId, businesses.id))
    .where(and(eq(businessReviews.id, id), eq(businesses.organizationId, organizationId)));
  if (!review) throw AppError.notFound('Review not found');

  await db.update(businessReviews).set({ isHidden: true }).where(eq(businessReviews.id, id));
  return { hidden: true };
}

export async function deleteReview(id: string, organizationId: string): Promise<void> {
  // Verify ownership via join
  const [review] = await db
    .select({ id: businessReviews.id })
    .from(businessReviews)
    .innerJoin(businesses, eq(businessReviews.businessId, businesses.id))
    .where(and(eq(businessReviews.id, id), eq(businesses.organizationId, organizationId)));
  if (!review) throw AppError.notFound('Review not found');

  await db.delete(businessReviews).where(eq(businessReviews.id, id));
}

// ── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics(organizationId: string) {
  const [totals] = await db
    .select({
      totalBusinesses:  count(),
      totalViews:       sql<number>`coalesce(sum(${businesses.totalViews}), 0)`,
      totalCalls:       sql<number>`coalesce(sum(${businesses.totalCalls}), 0)`,
      totalReviews:     sql<number>`coalesce(sum(${businesses.totalReviews}), 0)`,
      avgRating:        avg(businesses.averageRating),
    })
    .from(businesses)
    .where(eq(businesses.organizationId, organizationId));

  const statusBreakdown = await db
    .select({
      status: businesses.verificationStatus,
      count:  count(),
    })
    .from(businesses)
    .where(eq(businesses.organizationId, organizationId))
    .groupBy(businesses.verificationStatus);

  const topCategories = await db
    .select({
      categoryId:   businesses.categoryId,
      categoryName: businessCategories.name,
      count:        count(),
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .where(eq(businesses.organizationId, organizationId))
    .groupBy(businesses.categoryId, businessCategories.name)
    .orderBy(desc(count()))
    .limit(10);

  return { totals, statusBreakdown, topCategories };
}
