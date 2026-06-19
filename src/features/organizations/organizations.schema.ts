import { z } from 'zod';

// Subdomain: lowercase letters, numbers, hyphens only
const subdomainSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9-]+$/, 'Subdomain: only lowercase letters, numbers and hyphens')
  .optional();

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  subdomain: subdomainSchema,
  address: z.string().max(255).optional(),
  logoUrl: z.string().url().max(500).optional(),
  // Geo hierarchy
  regionId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  totalAreaSqm: z.number().int().positive().optional(),
  establishedAt: z.string().datetime({ offset: true }).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  subdomain: subdomainSchema,
  address: z.string().max(255).nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  regionId: z.string().uuid().nullable().optional(),
  districtId: z.string().uuid().nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  district: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  totalAreaSqm: z.number().int().positive().nullable().optional(),
  establishedAt: z.string().datetime({ offset: true }).nullable().optional(),
  boundaryGeojson: z.record(z.unknown()).nullable().optional(),
  chairman: z.string().max(255).optional(),
  chairmanPhone: z.string().max(20).optional(),
  populationCount: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  territoryId: z.string().uuid().nullable().optional(),
});

// platform-admin only
export const adminUpdateOrganizationSchema = updateOrganizationSchema.extend({
  status: z.enum(['active', 'trial', 'suspended']).optional(),
  subscriptionPlanId: z.string().uuid().nullable().optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'expired']).optional(),
});

// Extend subscription with calculated period end
export const adminSetSubscriptionSchema = z.object({
  planId: z.string().uuid().nullable().optional(),
  durationMonths: z.number().int().min(1).max(36),
});

export type AdminSetSubscriptionInput = z.infer<typeof adminSetSubscriptionSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type AdminUpdateOrganizationInput = z.infer<typeof adminUpdateOrganizationSchema>;
