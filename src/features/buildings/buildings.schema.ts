import { z } from 'zod';

const BUILDING_TYPES = ['apartment_block', 'private_house', 'commercial', 'mixed', 'school', 'kindergarten', 'hospital', 'government', 'other'] as const;
const BUILDING_STATUSES = ['active', 'under_repair', 'under_construction', 'demolished'] as const;

export const createBuildingSchema = z.object({
  number: z.string().min(1).max(20),
  name: z.string().max(200).optional(),
  buildingType: z.enum(BUILDING_TYPES).optional(),
  floorsCount: z.number().int().min(1).max(100).optional(),
  apartmentsCount: z.number().int().min(1).optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  streetId: z.string().uuid().optional(),
  latitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  longitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateBuildingSchema = createBuildingSchema.partial().extend({
  status: z.enum(BUILDING_STATUSES).optional(),
});

export const createApartmentSchema = z.object({
  number: z.string().min(1).max(20),
  floor: z.number().int().min(0).max(100).optional(),
  areaSqm: z.number().positive().optional(),
  roomsCount: z.number().int().min(0).max(20).optional(),
  apartmentType: z.enum(['apartment', 'house', 'room', 'office']).optional(),
});

export const buildingFilterSchema = z.object({
  streetId: z.string().uuid().optional(),
  buildingType: z.enum(BUILDING_TYPES).optional(),
  status: z.enum(BUILDING_STATUSES).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
export type CreateApartmentInput = z.infer<typeof createApartmentSchema>;
export type BuildingFilterInput = z.infer<typeof buildingFilterSchema>;
