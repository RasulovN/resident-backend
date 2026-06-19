import { and, avg, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { users } from '../users/users.model';
import {
  serviceCategories,
  serviceProviders,
  providerServices,
  providerReviews,
  providerOrders,
  type ServiceCategory,
} from './services.model';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateProviderInput,
  UpdateProviderInput,
  VerifyProviderInput,
  CreateProviderServiceInput,
  UpdateOrderStatusInput,
  ProviderListQuery,
} from './services.schema';

// ── Categories ──

export async function listCategories(organizationId: string): Promise<ServiceCategory[]> {
  return db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.organizationId, organizationId))
    .orderBy(serviceCategories.sortOrder, serviceCategories.name);
}

export async function createCategory(
  organizationId: string,
  input: CreateCategoryInput,
): Promise<ServiceCategory> {
  const [created] = await db
    .insert(serviceCategories)
    .values({
      organizationId,
      name: input.name,
      slug: input.slug,
      icon: input.icon,
      description: input.description,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return created!;
}

export async function updateCategory(
  organizationId: string,
  id: string,
  input: UpdateCategoryInput,
): Promise<ServiceCategory> {
  const [updated] = await db
    .update(serviceCategories)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    })
    .where(and(eq(serviceCategories.id, id), eq(serviceCategories.organizationId, organizationId)))
    .returning();
  if (!updated) throw AppError.notFound('Category not found');
  return updated;
}

export async function deleteCategory(organizationId: string, id: string): Promise<void> {
  const [deleted] = await db
    .delete(serviceCategories)
    .where(and(eq(serviceCategories.id, id), eq(serviceCategories.organizationId, organizationId)))
    .returning({ id: serviceCategories.id });
  if (!deleted) throw AppError.notFound('Category not found');
}

export async function seedDefaultCategories(organizationId: string): Promise<void> {
  const existing = await db
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(eq(serviceCategories.organizationId, organizationId))
    .limit(1);

  if (existing.length > 0) return;

  const defaults = [
    { name: 'Santexnik', slug: 'santexnik', icon: '🔧' },
    { name: 'Elektrik', slug: 'elektrik', icon: '⚡' },
    { name: 'Gaz ustasi', slug: 'gaz-ustasi', icon: '🔥' },
    { name: 'Internet ustasi', slug: 'internet', icon: '🌐' },
    { name: 'Konditsioner', slug: 'konditsioner', icon: '❄️' },
    { name: 'Tozalash', slug: 'tozalash', icon: '🧹' },
    { name: "Uy ta'mirlash", slug: 'uy-tamirlash', icon: '🏠' },
    { name: 'Qurilish', slug: 'qurilish', icon: '🏗️' },
    { name: 'Payvandchi', slug: 'payvandchi', icon: '🔩' },
    { name: 'Avto xizmat', slug: 'avto', icon: '🚗' },
    { name: 'Tutor', slug: 'tutor', icon: '📚' },
    { name: 'IT xizmatlari', slug: 'it', icon: '💻' },
    { name: 'Hamshira', slug: 'hamshira', icon: '🏥' },
    { name: 'Qarovchi', slug: 'qarovchi', icon: '👴' },
    { name: 'Tikuvchi', slug: 'tikuvchi', icon: '🧵' },
    { name: "Go'zallik", slug: 'gozallik', icon: '💄' },
    { name: 'Uy ovqatlari', slug: 'uy-ovqatlari', icon: '🍱' },
    { name: 'Delivery', slug: 'delivery', icon: '🚴' },
  ];

  await db
    .insert(serviceCategories)
    .values(
      defaults.map((d, i) => ({
        organizationId,
        name: d.name,
        slug: d.slug,
        icon: d.icon,
        sortOrder: i,
      })),
    )
    .onConflictDoNothing();
}

// ── Providers ──

export async function listProviders(organizationId: string, query: ProviderListQuery) {
  const pagination: Pagination = { page: query.page, limit: query.limit };

  const conditions = [eq(serviceProviders.organizationId, organizationId)];

  if (query.verificationStatus) {
    conditions.push(eq(serviceProviders.verificationStatus, query.verificationStatus));
  }

  if (query.search) {
    const q = `%${query.search}%`;
    conditions.push(
      or(
        ilike(serviceProviders.businessName, q),
        ilike(serviceProviders.phone, q),
      )!,
    );
  }

  const where = and(...conditions);

  const ownerUsers = users;

  const rows = await db
    .select({
      id: serviceProviders.id,
      businessName: serviceProviders.businessName,
      phone: serviceProviders.phone,
      telegram: serviceProviders.telegram,
      verificationStatus: serviceProviders.verificationStatus,
      status: serviceProviders.status,
      averageRating: serviceProviders.averageRating,
      totalReviews: serviceProviders.totalReviews,
      totalOrders: serviceProviders.totalOrders,
      isAvailable: serviceProviders.isAvailable,
      createdAt: serviceProviders.createdAt,
      userId: serviceProviders.userId,
      ownerEmail: ownerUsers.email,
      ownerName: sql<string>`concat(${ownerUsers.firstName}, ' ', ${ownerUsers.lastName})`,
    })
    .from(serviceProviders)
    .leftJoin(ownerUsers, eq(serviceProviders.userId, ownerUsers.id))
    .where(where)
    .orderBy(desc(serviceProviders.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(serviceProviders)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function getProvider(organizationId: string, id: string) {
  const provider = await db.query.serviceProviders.findFirst({
    where: and(eq(serviceProviders.id, id), eq(serviceProviders.organizationId, organizationId)),
  });
  if (!provider) throw AppError.notFound('Provider not found');

  // Get owner user info
  let ownerInfo = null;
  if (provider.userId) {
    ownerInfo = await db.query.users.findFirst({
      where: eq(users.id, provider.userId),
    });
  }

  // Get provider services with category names
  const services = await db
    .select({
      id: providerServices.id,
      providerId: providerServices.providerId,
      categoryId: providerServices.categoryId,
      serviceName: providerServices.serviceName,
      description: providerServices.description,
      minPrice: providerServices.minPrice,
      maxPrice: providerServices.maxPrice,
      createdAt: providerServices.createdAt,
      categoryName: serviceCategories.name,
      categoryIcon: serviceCategories.icon,
    })
    .from(providerServices)
    .leftJoin(serviceCategories, eq(providerServices.categoryId, serviceCategories.id))
    .where(eq(providerServices.providerId, id));

  return {
    ...provider,
    owner: ownerInfo
      ? {
          id: ownerInfo.id,
          email: ownerInfo.email,
          firstName: ownerInfo.firstName,
          lastName: ownerInfo.lastName,
          phone: ownerInfo.phone,
        }
      : null,
    services,
  };
}

export async function createProvider(
  organizationId: string,
  userId: string | null,
  input: CreateProviderInput,
) {
  const [created] = await db
    .insert(serviceProviders)
    .values({
      organizationId,
      userId,
      businessName: input.businessName,
      description: input.description,
      phone: input.phone,
      telegram: input.telegram,
      experienceYears: input.experienceYears ?? 0,
      serviceRadiusKm: input.serviceRadiusKm ?? 5,
      isAvailable: input.isAvailable ?? true,
    })
    .returning();
  return created!;
}

export async function updateProvider(
  organizationId: string,
  id: string,
  input: UpdateProviderInput,
) {
  const [updated] = await db
    .update(serviceProviders)
    .set({
      ...(input.businessName !== undefined && { businessName: input.businessName }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.telegram !== undefined && { telegram: input.telegram }),
      ...(input.experienceYears !== undefined && { experienceYears: input.experienceYears }),
      ...(input.serviceRadiusKm !== undefined && { serviceRadiusKm: input.serviceRadiusKm }),
      ...(input.isAvailable !== undefined && { isAvailable: input.isAvailable }),
      updatedAt: new Date(),
    })
    .where(and(eq(serviceProviders.id, id), eq(serviceProviders.organizationId, organizationId)))
    .returning();
  if (!updated) throw AppError.notFound('Provider not found');
  return updated;
}

export async function verifyProvider(
  organizationId: string,
  id: string,
  verifierId: string,
  input: VerifyProviderInput,
) {
  const statusMap: Record<string, 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW'> = {
    approve: 'APPROVED',
    reject: 'REJECTED',
    under_review: 'UNDER_REVIEW',
  };

  const verificationStatus = statusMap[input.action];

  const updateData: Record<string, unknown> = {
    verificationStatus,
    updatedAt: new Date(),
  };

  if (input.action === 'approve') {
    updateData.verifiedAt = new Date();
    updateData.verifiedById = verifierId;
    updateData.rejectionReason = null;
  } else if (input.action === 'reject') {
    updateData.rejectionReason = input.rejectionReason ?? null;
    updateData.verifiedAt = null;
    updateData.verifiedById = null;
  }

  const [updated] = await db
    .update(serviceProviders)
    .set(updateData)
    .where(and(eq(serviceProviders.id, id), eq(serviceProviders.organizationId, organizationId)))
    .returning();
  if (!updated) throw AppError.notFound('Provider not found');
  return updated;
}

export async function deleteProvider(organizationId: string, id: string) {
  const [deleted] = await db
    .delete(serviceProviders)
    .where(and(eq(serviceProviders.id, id), eq(serviceProviders.organizationId, organizationId)))
    .returning({ id: serviceProviders.id });
  if (!deleted) throw AppError.notFound('Provider not found');
}

// ── Provider Services ──

export async function listProviderServices(providerId: string) {
  return db
    .select({
      id: providerServices.id,
      providerId: providerServices.providerId,
      categoryId: providerServices.categoryId,
      serviceName: providerServices.serviceName,
      description: providerServices.description,
      minPrice: providerServices.minPrice,
      maxPrice: providerServices.maxPrice,
      createdAt: providerServices.createdAt,
      categoryName: serviceCategories.name,
      categoryIcon: serviceCategories.icon,
    })
    .from(providerServices)
    .leftJoin(serviceCategories, eq(providerServices.categoryId, serviceCategories.id))
    .where(eq(providerServices.providerId, providerId));
}

export async function addProviderService(
  organizationId: string,
  providerId: string,
  input: CreateProviderServiceInput,
) {
  // Verify provider belongs to org
  const provider = await db.query.serviceProviders.findFirst({
    where: and(
      eq(serviceProviders.id, providerId),
      eq(serviceProviders.organizationId, organizationId),
    ),
  });
  if (!provider) throw AppError.notFound('Provider not found');

  const [created] = await db
    .insert(providerServices)
    .values({
      providerId,
      categoryId: input.categoryId,
      serviceName: input.serviceName,
      description: input.description,
      minPrice: input.minPrice != null ? String(input.minPrice) : undefined,
      maxPrice: input.maxPrice != null ? String(input.maxPrice) : undefined,
    })
    .returning();
  return created!;
}

export async function removeProviderService(
  organizationId: string,
  providerId: string,
  serviceId: string,
) {
  // Verify provider belongs to org
  const provider = await db.query.serviceProviders.findFirst({
    where: and(
      eq(serviceProviders.id, providerId),
      eq(serviceProviders.organizationId, organizationId),
    ),
  });
  if (!provider) throw AppError.notFound('Provider not found');

  const [deleted] = await db
    .delete(providerServices)
    .where(
      and(eq(providerServices.id, serviceId), eq(providerServices.providerId, providerId)),
    )
    .returning({ id: providerServices.id });
  if (!deleted) throw AppError.notFound('Provider service not found');
}

// ── Reviews ──

export async function listReviews(
  organizationId: string,
  providerId: string | undefined,
  pagination: Pagination,
) {
  const conditions = [eq(providerReviews.organizationId, organizationId)];
  if (providerId) {
    conditions.push(eq(providerReviews.providerId, providerId));
  }
  const where = and(...conditions);

  const reviewers = users;

  const rows = await db
    .select({
      id: providerReviews.id,
      providerId: providerReviews.providerId,
      organizationId: providerReviews.organizationId,
      residentId: providerReviews.residentId,
      rating: providerReviews.rating,
      comment: providerReviews.comment,
      isHidden: providerReviews.isHidden,
      createdAt: providerReviews.createdAt,
      reviewerFirstName: reviewers.firstName,
      reviewerLastName: reviewers.lastName,
      reviewerEmail: reviewers.email,
    })
    .from(providerReviews)
    .leftJoin(reviewers, eq(providerReviews.residentId, reviewers.id))
    .where(where)
    .orderBy(desc(providerReviews.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(providerReviews)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function hideReview(id: string, organizationId: string) {
  const [updated] = await db
    .update(providerReviews)
    .set({ isHidden: true })
    .where(and(eq(providerReviews.id, id), eq(providerReviews.organizationId, organizationId)))
    .returning();
  if (!updated) throw AppError.notFound('Review not found');
  return updated;
}

export async function deleteReview(id: string, organizationId: string) {
  const [deleted] = await db
    .delete(providerReviews)
    .where(and(eq(providerReviews.id, id), eq(providerReviews.organizationId, organizationId)))
    .returning({ id: providerReviews.id });
  if (!deleted) throw AppError.notFound('Review not found');
}

// ── Orders ──

export async function listOrders(
  organizationId: string,
  status?: string,
  pagination?: Pagination,
) {
  const pg: Pagination = pagination ?? { page: 1, limit: 20 };
  const conditions = [eq(providerOrders.organizationId, organizationId)];

  if (status) {
    conditions.push(
      eq(providerOrders.status, status as 'NEW' | 'ACCEPTED' | 'ON_THE_WAY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'),
    );
  }

  const where = and(...conditions);

  const rows = await db
    .select()
    .from(providerOrders)
    .where(where)
    .orderBy(desc(providerOrders.createdAt))
    .limit(pg.limit)
    .offset(getOffset(pg));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(providerOrders)
    .where(where);

  return paginated(rows, total, pg);
}

export async function getOrderStats(organizationId: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      newCount: sql<number>`count(*) filter (where status = 'NEW')::int`,
      accepted: sql<number>`count(*) filter (where status = 'ACCEPTED')::int`,
      onTheWay: sql<number>`count(*) filter (where status = 'ON_THE_WAY')::int`,
      inProgress: sql<number>`count(*) filter (where status = 'IN_PROGRESS')::int`,
      completed: sql<number>`count(*) filter (where status = 'COMPLETED')::int`,
      cancelled: sql<number>`count(*) filter (where status = 'CANCELLED')::int`,
    })
    .from(providerOrders)
    .where(eq(providerOrders.organizationId, organizationId));
  return stats;
}

export async function updateOrderStatus(
  organizationId: string,
  orderId: string,
  input: UpdateOrderStatusInput,
) {
  const [updated] = await db
    .update(providerOrders)
    .set({
      status: input.status,
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date(),
    })
    .where(
      and(eq(providerOrders.id, orderId), eq(providerOrders.organizationId, organizationId)),
    )
    .returning();
  if (!updated) throw AppError.notFound('Order not found');
  return updated;
}

// ── Analytics ──

export async function getAnalytics(organizationId: string) {
  const [providerStats] = await db
    .select({
      totalProviders: sql<number>`count(*)::int`,
      verifiedProviders: sql<number>`count(*) filter (where verification_status = 'APPROVED')::int`,
      pendingProviders: sql<number>`count(*) filter (where verification_status = 'PENDING')::int`,
      averageRating: avg(serviceProviders.averageRating),
    })
    .from(serviceProviders)
    .where(eq(serviceProviders.organizationId, organizationId));

  const [orderStats] = await db
    .select({ totalOrders: sql<number>`count(*)::int` })
    .from(providerOrders)
    .where(eq(providerOrders.organizationId, organizationId));

  const [reviewStats] = await db
    .select({ totalReviews: sql<number>`count(*)::int` })
    .from(providerReviews)
    .where(eq(providerReviews.organizationId, organizationId));

  // Top 5 providers by average rating (APPROVED only)
  const topRated = await db
    .select({
      id: serviceProviders.id,
      businessName: serviceProviders.businessName,
      phone: serviceProviders.phone,
      averageRating: serviceProviders.averageRating,
      totalReviews: serviceProviders.totalReviews,
      totalOrders: serviceProviders.totalOrders,
    })
    .from(serviceProviders)
    .where(
      and(
        eq(serviceProviders.organizationId, organizationId),
        eq(serviceProviders.verificationStatus, 'APPROVED'),
      ),
    )
    .orderBy(desc(serviceProviders.averageRating))
    .limit(5);

  // Provider services count by category
  const byCategory = await db
    .select({
      categoryId: providerServices.categoryId,
      categoryName: serviceCategories.name,
      categoryIcon: serviceCategories.icon,
      providerCount: sql<number>`count(distinct ${providerServices.providerId})::int`,
      serviceCount: sql<number>`count(*)::int`,
    })
    .from(providerServices)
    .leftJoin(serviceCategories, eq(providerServices.categoryId, serviceCategories.id))
    .leftJoin(serviceProviders, eq(providerServices.providerId, serviceProviders.id))
    .where(eq(serviceProviders.organizationId, organizationId))
    .groupBy(providerServices.categoryId, serviceCategories.name, serviceCategories.icon);

  // Monthly registrations — last 6 months
  const monthlyRegistrations = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${serviceProviders.createdAt}), 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
    })
    .from(serviceProviders)
    .where(
      and(
        eq(serviceProviders.organizationId, organizationId),
        sql`${serviceProviders.createdAt} >= now() - interval '6 months'`,
      ),
    )
    .groupBy(sql`date_trunc('month', ${serviceProviders.createdAt})`)
    .orderBy(sql`date_trunc('month', ${serviceProviders.createdAt})`);

  return {
    totalProviders: providerStats?.totalProviders ?? 0,
    verifiedProviders: providerStats?.verifiedProviders ?? 0,
    pendingProviders: providerStats?.pendingProviders ?? 0,
    averageRating: providerStats?.averageRating ?? null,
    totalOrders: orderStats?.totalOrders ?? 0,
    totalReviews: reviewStats?.totalReviews ?? 0,
    topRated,
    byCategory,
    monthlyRegistrations,
  };
}
