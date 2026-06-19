import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { residents } from '../residents/residents.model';
import { households } from './households.model';
import type { CreateHouseholdInput, HouseholdFilterInput, UpdateHouseholdInput } from './households.schema';

export async function listHouseholds(mahallaId: string, filter: HouseholdFilterInput) {
  const pagination: Pagination = { page: filter.page, limit: filter.limit };

  const conditions = [eq(households.mahallaId, mahallaId)];
  if (filter.apartmentId) conditions.push(eq(households.apartmentId, filter.apartmentId));
  if (filter.search) {
    conditions.push(ilike(households.householdName, `%${filter.search}%`));
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      id: households.id,
      householdName: households.householdName,
      apartmentId: households.apartmentId,
      headResidentId: households.headResidentId,
      happinessScore: households.happinessScore,
      createdAt: households.createdAt,
    })
    .from(households)
    .where(where)
    .orderBy(desc(households.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(households)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function getHousehold(id: string, mahallaId: string) {
  const household = await db.query.households.findFirst({
    where: and(eq(households.id, id), eq(households.mahallaId, mahallaId)),
  });
  if (!household) throw AppError.notFound('Household not found');
  return household;
}

export async function getHouseholdProfile(id: string, mahallaId: string) {
  const household = await db.query.households.findFirst({
    where: and(eq(households.id, id), eq(households.mahallaId, mahallaId)),
  });
  if (!household) throw AppError.notFound('Household not found');

  const members = await db
    .select({
      id: residents.id,
      firstName: residents.firstName,
      lastName: residents.lastName,
      middleName: residents.middleName,
      gender: residents.gender,
      birthDate: residents.birthDate,
      phone: residents.phone,
      employmentStatus: residents.employmentStatus,
      status: residents.status,
    })
    .from(residents)
    .where(and(eq(residents.householdId, id), eq(residents.mahallaId, mahallaId)));

  return { household, members };
}

export async function createHousehold(mahallaId: string, input: CreateHouseholdInput) {
  const [created] = await db
    .insert(households)
    .values({ mahallaId, ...input })
    .returning();
  return created!;
}

export async function updateHousehold(id: string, mahallaId: string, input: UpdateHouseholdInput) {
  const [updated] = await db
    .update(households)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(households.id, id), eq(households.mahallaId, mahallaId)))
    .returning();
  if (!updated) throw AppError.notFound('Household not found');
  return updated;
}

export async function deleteHousehold(id: string, mahallaId: string) {
  const [deleted] = await db
    .delete(households)
    .where(and(eq(households.id, id), eq(households.mahallaId, mahallaId)))
    .returning({ id: households.id });
  if (!deleted) throw AppError.notFound('Household not found');
}

export async function getMahallaHouseholdStats(mahallaId: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      avgHappiness: sql<number>`avg(happiness_score)::decimal(4,2)`,
    })
    .from(households)
    .where(eq(households.mahallaId, mahallaId));
  return stats;
}
