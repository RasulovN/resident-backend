import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { districts, regions } from './geo.model';

export async function listRegions() {
  return db
    .select({ id: regions.id, name: regions.name, nameRu: regions.nameRu, code: regions.code })
    .from(regions)
    .orderBy(regions.sortOrder);
}

export async function listDistricts(regionId?: string) {
  const query = db
    .select({
      id: districts.id,
      regionId: districts.regionId,
      name: districts.name,
      nameRu: districts.nameRu,
      isCity: districts.isCity,
    })
    .from(districts)
    .orderBy(districts.sortOrder);

  if (regionId) {
    return query.where(eq(districts.regionId, regionId));
  }
  return query;
}
