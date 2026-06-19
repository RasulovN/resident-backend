import { z } from 'zod';

export const planLimitsSchema = z.object({
  maxUsers: z.number().int().nullable(),
  maxMenus: z.number().int().nullable(),
  maxRecords: z.number().int().nullable(),
  features: z.array(z.string()),
});

export const createPlanSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  currency: z.string().min(2).max(8).default('UZS'),
  interval: z.enum(['month', 'year']).default('month'),
  limits: planLimitsSchema,
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const updatePlanSchema = createPlanSchema.partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
