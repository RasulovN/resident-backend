import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { mahallaTerritories, type MahallaTerritory } from './territories.model';
import { organizations } from '../organizations/organizations.model';

export async function listTerritories() {
  const territories = await db.select().from(mahallaTerritories).orderBy(mahallaTerritories.number);
  const orgs = await db.select({
    id: organizations.id,
    name: organizations.name,
    territoryId: organizations.territoryId,
  }).from(organizations);

  const orgMap = new Map<string, { id: string; name: string }>();
  for (const org of orgs) {
    if (org.territoryId) orgMap.set(org.territoryId, { id: org.id, name: org.name });
  }

  return territories.map(t => ({
    ...t,
    linkedOrgId: orgMap.get(t.id)?.id ?? null,
    linkedOrgName: orgMap.get(t.id)?.name ?? null,
  }));
}

export async function linkOrgToTerritory(organizationId: string, territoryId: string | null): Promise<void> {
  await db.update(organizations).set({ territoryId }).where(eq(organizations.id, organizationId));
}
