import { z } from 'zod';

export const createHouseholdSchema = z.object({
  apartmentId: z.string().uuid().optional(),
  headResidentId: z.string().uuid().optional(),
  householdName: z.string().max(200).optional(),
  happinessScore: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateHouseholdSchema = createHouseholdSchema.partial();

export const householdFilterSchema = z.object({
  apartmentId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
export type HouseholdFilterInput = z.infer<typeof householdFilterSchema>;
