import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { apartments, buildings } from '../buildings/buildings.model';
import { households } from '../households/households.model';
import { streets } from '../streets/streets.model';
import { residents, populationEvents, residentRelocations } from './residents.model';
import type { CreateResidentInput, UpdateResidentInput, ResidentFilterInput } from './residents.schema';

export async function listResidents(mahallaId: string, filter: ResidentFilterInput) {
  const pagination: Pagination = { page: filter.page, limit: filter.limit };

  const conditions = [eq(residents.mahallaId, mahallaId)];

  if (filter.status) conditions.push(eq(residents.status, filter.status));
  if (filter.gender) conditions.push(eq(residents.gender, filter.gender));
  if (filter.employmentStatus) conditions.push(eq(residents.employmentStatus, filter.employmentStatus));
  if (filter.householdId) conditions.push(eq(residents.householdId, filter.householdId));
  if (filter.apartmentId) conditions.push(eq(residents.apartmentId, filter.apartmentId));

  if (filter.search) {
    const q = `%${filter.search}%`;
    conditions.push(
      or(
        ilike(residents.firstName, q),
        ilike(residents.lastName, q),
        ilike(residents.middleName, q),
        ilike(residents.phone, q),
        ilike(residents.pinfl, q),
      )!,
    );
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      id: residents.id,
      firstName: residents.firstName,
      lastName: residents.lastName,
      middleName: residents.middleName,
      phone: residents.phone,
      birthDate: residents.birthDate,
      gender: residents.gender,
      status: residents.status,
      employmentStatus: residents.employmentStatus,
      happinessScore: residents.happinessScore,
      hasVehicle: residents.hasVehicle,
      householdId: residents.householdId,
      apartmentId: residents.apartmentId,
      userId: residents.userId,
      createdAt: residents.createdAt,
    })
    .from(residents)
    .where(where)
    .orderBy(desc(residents.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(residents)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function getResident(id: string, mahallaId: string) {
  const resident = await db.query.residents.findFirst({
    where: and(eq(residents.id, id), eq(residents.mahallaId, mahallaId)),
  });
  if (!resident) throw AppError.notFound('Resident not found');
  return resident;
}

export async function createResident(mahallaId: string, input: CreateResidentInput) {
  const [created] = await db
    .insert(residents)
    .values({
      mahallaId,
      firstName: input.firstName,
      lastName: input.lastName,
      middleName: input.middleName,
      phone: input.phone,
      phone2: input.phone2,
      email: input.email,
      passportSeries: input.passportSeries,
      passportNumber: input.passportNumber,
      pinfl: input.pinfl,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
      gender: input.gender,
      educationLevel: input.educationLevel,
      occupation: input.occupation,
      employmentStatus: input.employmentStatus,
      socialStatus: input.socialStatus,
      languages: input.languages,
      digitalSkillLevel: input.digitalSkillLevel,
      disabilityType: input.disabilityType,
      disabilityNotes: input.disabilityNotes,
      hobbies: input.hobbies,
      interests: input.interests,
      happinessScore: input.happinessScore,
      hasVehicle: input.hasVehicle ?? false,
      householdId: input.householdId,
      apartmentId: input.apartmentId,
      status: input.status ?? 'active',
      registeredAt: input.registeredAt ? new Date(input.registeredAt) : new Date(),
    })
    .returning();
  return created!;
}

export async function updateResident(id: string, mahallaId: string, input: UpdateResidentInput) {
  const update: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.birthDate) update.birthDate = new Date(input.birthDate);
  if (input.registeredAt) update.registeredAt = new Date(input.registeredAt);

  const [updated] = await db
    .update(residents)
    .set(update)
    .where(and(eq(residents.id, id), eq(residents.mahallaId, mahallaId)))
    .returning();
  if (!updated) throw AppError.notFound('Resident not found');
  return updated;
}

export async function deleteResident(id: string, mahallaId: string) {
  const [deleted] = await db
    .delete(residents)
    .where(and(eq(residents.id, id), eq(residents.mahallaId, mahallaId)))
    .returning({ id: residents.id });
  if (!deleted) throw AppError.notFound('Resident not found');
}

export async function getResidentProfile(id: string, mahallaId: string) {
  const resident = await db.query.residents.findFirst({
    where: and(eq(residents.id, id), eq(residents.mahallaId, mahallaId)),
  });
  if (!resident) throw AppError.notFound('Resident not found');

  // Fetch household
  let household = null;
  if (resident.householdId) {
    household = await db.query.households.findFirst({
      where: eq(households.id, resident.householdId),
    });
  }

  // Fetch apartment + building + street
  let apartment = null;
  let building = null;
  let street = null;
  if (resident.apartmentId) {
    apartment = await db.query.apartments.findFirst({
      where: eq(apartments.id, resident.apartmentId),
    });
    if (apartment?.buildingId) {
      building = await db.query.buildings.findFirst({
        where: eq(buildings.id, apartment.buildingId),
      });
      if (building?.streetId) {
        street = await db.query.streets.findFirst({
          where: eq(streets.id, building.streetId),
        });
      }
    }
  }

  // Population events for this resident
  const events = await db
    .select()
    .from(populationEvents)
    .where(eq(populationEvents.residentId, id))
    .orderBy(desc(populationEvents.eventDate))
    .limit(10);

  // Relocations
  const relocations = await db
    .select()
    .from(residentRelocations)
    .where(eq(residentRelocations.residentId, id))
    .orderBy(desc(residentRelocations.createdAt))
    .limit(5);

  return { resident, household, apartment, building, street, events, relocations };
}

export async function getMahallaResidentStats(mahallaId: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where status = 'active')::int`,
      male: sql<number>`count(*) filter (where gender = 'male')::int`,
      female: sql<number>`count(*) filter (where gender = 'female')::int`,
      employed: sql<number>`count(*) filter (where employment_status = 'employed')::int`,
      unemployed: sql<number>`count(*) filter (where employment_status = 'unemployed')::int`,
    })
    .from(residents)
    .where(eq(residents.mahallaId, mahallaId));
  return stats;
}
