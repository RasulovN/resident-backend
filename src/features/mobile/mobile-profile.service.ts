import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { residentAddresses, residentDetails } from './mobile-profile.model';

type AddressInput = {
  street?: string;
  building?: string;
  apartment?: string;
  household?: string;
  landmark?: string;
};

type DetailsInput = {
  educationLevel?: string;
  profession?: string;
  employmentStatus?: string;
  socialStatus?: string;
  languages?: string[];
  digitalSkill?: string;
  hobbies?: string;
  happinessLevel?: number;
  healthNotes?: string;
  specialNeeds?: string;
  hasCar?: boolean;
  carModel?: string;
  carPlate?: string;
};

export async function getAddress(userId: string) {
  const row = await db.query.residentAddresses.findFirst({ where: eq(residentAddresses.userId, userId) });
  return row ?? null;
}

export async function upsertAddress(userId: string, input: AddressInput) {
  const [row] = await db
    .insert(residentAddresses)
    .values({ userId, ...input })
    .onConflictDoUpdate({
      target: residentAddresses.userId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getDetails(userId: string) {
  const row = await db.query.residentDetails.findFirst({ where: eq(residentDetails.userId, userId) });
  return row ?? null;
}

export async function upsertDetails(userId: string, input: DetailsInput) {
  const [row] = await db
    .insert(residentDetails)
    .values({ userId, ...input })
    .onConflictDoUpdate({
      target: residentDetails.userId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return row!;
}
