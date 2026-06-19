import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  icon: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createProviderSchema = z.object({
  businessName: z.string().min(1).max(200),
  description: z.string().optional(),
  phone: z.string().min(7).max(20),
  telegram: z.string().optional(),
  experienceYears: z.number().int().min(0).max(50).default(0),
  serviceRadiusKm: z.number().int().min(1).max(100).default(5),
  isAvailable: z.boolean().default(true),
});

export const updateProviderSchema = createProviderSchema.partial();

export const verifyProviderSchema = z.object({
  action: z.enum(['approve', 'reject', 'under_review']),
  rejectionReason: z.string().optional(),
});

export const createProviderServiceSchema = z.object({
  categoryId: z.string().uuid(),
  serviceName: z.string().min(1).max(200),
  description: z.string().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
});

export const createReviewSchema = z.object({
  providerId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const createOrderSchema = z.object({
  providerId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  description: z.string().min(1).max(2000),
  location: z.string().optional(),
  preferredTime: z.string().datetime().optional(),
  photos: z.array(z.string().url()).default([]),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  notes: z.string().optional(),
});

export const providerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  verificationStatus: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  categoryId: z.string().uuid().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type VerifyProviderInput = z.infer<typeof verifyProviderSchema>;
export type CreateProviderServiceInput = z.infer<typeof createProviderServiceSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ProviderListQuery = z.infer<typeof providerListQuerySchema>;
