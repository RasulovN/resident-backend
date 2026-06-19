import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { residents } from '../residents/residents.model';
import { households } from '../households/households.model';
import { apartments, buildings } from './buildings.model';

export async function listBuildings(mahallaId: string, pagination: Pagination) {
  const where = eq(buildings.mahallaId, mahallaId);

  const rows = await db
    .select({
      id: buildings.id,
      name: buildings.name,
      number: buildings.number,
      buildingType: buildings.buildingType,
      floorsCount: buildings.floorsCount,
      apartmentsCount: buildings.apartmentsCount,
      yearBuilt: buildings.yearBuilt,
      status: buildings.status,
      streetId: buildings.streetId,
      createdAt: buildings.createdAt,
    })
    .from(buildings)
    .where(where)
    .orderBy(buildings.number)
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(buildings)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function getBuilding(id: string, mahallaId: string) {
  const building = await db.query.buildings.findFirst({
    where: and(eq(buildings.id, id), eq(buildings.mahallaId, mahallaId)),
  });
  if (!building) throw AppError.notFound('Building not found');
  return building;
}

export async function getBuildingProfile(id: string, mahallaId: string) {
  const building = await db.query.buildings.findFirst({
    where: and(eq(buildings.id, id), eq(buildings.mahallaId, mahallaId)),
  });
  if (!building) throw AppError.notFound('Building not found');

  const aptList = await db
    .select()
    .from(apartments)
    .where(eq(apartments.buildingId, id));

  const aptIds = aptList.map((a) => a.id);

  let residentCount = 0;
  let householdCount = 0;

  if (aptIds.length > 0) {
    const [rc] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(residents)
      .where(and(eq(residents.mahallaId, mahallaId)));
    residentCount = rc?.total ?? 0;

    const [hc] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(households)
      .where(and(eq(households.mahallaId, mahallaId)));
    householdCount = hc?.total ?? 0;
  }

  return { building, apartments: aptList, residentCount, householdCount };
}

export async function createBuilding(
  mahallaId: string,
  input: {
    name?: string;
    number: string;
    buildingType?: string;
    floorsCount?: number;
    apartmentsCount?: number;
    yearBuilt?: number;
    streetId?: string;
    latitude?: string;
    longitude?: string;
    notes?: string;
  },
) {
  const [created] = await db
    .insert(buildings)
    .values({ mahallaId, ...input } as typeof buildings.$inferInsert)
    .returning();
  return created!;
}

export async function updateBuilding(
  id: string,
  mahallaId: string,
  input: Partial<typeof buildings.$inferInsert>,
) {
  const [updated] = await db
    .update(buildings)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(buildings.id, id), eq(buildings.mahallaId, mahallaId)))
    .returning();
  if (!updated) throw AppError.notFound('Building not found');
  return updated;
}

// Apartments
export async function listApartments(buildingId: string) {
  return db.select().from(apartments).where(eq(apartments.buildingId, buildingId)).orderBy(apartments.number);
}

export async function createApartment(
  buildingId: string,
  input: { number: string; floor?: number; areaSqm?: number; roomsCount?: number; apartmentType?: string },
) {
  const [created] = await db
    .insert(apartments)
    .values({ buildingId, ...input } as typeof apartments.$inferInsert)
    .returning();
  return created!;
}
