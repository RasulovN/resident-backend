import { z } from 'zod';

export const businessKindEnum = z.enum(['food', 'retail', 'service', 'venue', 'other']);

export const createBusinessCategorySchema = z.object({
  name:        z.string().min(1).max(100),
  slug:        z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  icon:        z.string().optional(),
  description: z.string().optional(),
  kind:        businessKindEnum.optional(),
  sortOrder:   z.number().int().default(0),
  isActive:    z.boolean().default(true),
});

export const updateBusinessCategorySchema = createBusinessCategorySchema.partial();

export const createBusinessSchema = z.object({
  categoryId:            z.string().uuid().optional(),
  businessName:          z.string().min(1).max(200),
  legalName:             z.string().max(200).optional(),
  phone:                 z.string().min(7).max(20).optional(),
  additionalPhone:       z.string().max(20).optional(),
  telegram:              z.string().max(100).optional(),
  website:               z.string().url().optional(),
  address:               z.string().max(500).optional(),
  latitude:              z.number().optional(),
  longitude:             z.number().optional(),
  description:           z.string().max(2000).optional(),
  logo:                  z.string().optional(),
  coverImage:            z.string().optional(),
  onlineOrderingEnabled: z.boolean().default(false),
});

export const updateBusinessSchema = createBusinessSchema.partial();

export const verifyBusinessSchema = z.object({
  action:          z.enum(['approve', 'reject', 'under_review', 'suspend', 'close']),
  rejectionReason: z.string().optional(),
});

export const businessListQuerySchema = z.object({
  page:               z.coerce.number().int().min(1).default(1),
  limit:              z.coerce.number().int().min(1).max(100).default(20),
  search:             z.string().optional(),
  verificationStatus: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'CLOSED']).optional(),
  categoryId:         z.string().uuid().optional(),
  status:             z.enum(['active', 'inactive', 'suspended']).optional(),
});

export const createBusinessProductSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().optional(),
  image:       z.string().optional(),
  images:      z.array(z.string()).max(10).optional(),
  unit:        z.string().max(50).optional(),
  sectionId:   z.string().uuid().nullable().optional(),
  portion:     z.string().max(50).optional(),
  price:       z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  stock:       z.number().int().min(0).optional(),
  isAvailable: z.boolean().default(true),
});

export const updateBusinessProductSchema = createBusinessProductSchema.partial();

export const addProductImageSchema = z.object({ url: z.string().min(1) });
export const reorderProductImagesSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

// ── Menu sections (food) ────────────────────────────────────────────────────
export const createMenuSectionSchema = z.object({
  name:      z.string().min(1).max(100),
  sortOrder: z.number().int().default(0),
});
export const updateMenuSectionSchema = createMenuSectionSchema.partial();

// ── Reservations ────────────────────────────────────────────────────────────
export const reservationSettingsSchema = z.object({
  enabled:        z.boolean().optional(),
  slotMinutes:    z.number().int().min(15).max(480).optional(),
  partySizeMax:   z.number().int().min(1).max(100).nullable().optional(),
  leadMinMinutes: z.number().int().min(0).optional(),
  note:           z.string().max(500).nullable().optional(),
});
export const createResourceSchema = z.object({
  name:      z.string().min(1).max(100),
  capacity:  z.number().int().min(1).max(100).default(2),
  isActive:  z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export const updateResourceSchema = createResourceSchema.partial();
export const createReservationSchema = z.object({
  startsAt:     z.string().datetime(),
  partySize:    z.number().int().min(1).max(100).default(1),
  resourceId:   z.string().uuid().nullable().optional(),
  contactName:  z.string().max(120).optional(),
  contactPhone: z.string().max(32).optional(),
  note:         z.string().max(500).optional(),
});
export const reservationStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'seated', 'no_show', 'completed']),
});
export const availabilityQuerySchema = z.object({
  date:      z.string(),                 // YYYY-MM-DD
  partySize: z.coerce.number().int().min(1).max(100).default(1),
});

export const createBusinessServiceItemSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().optional(),
  priceFrom:   z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  priceTo:     z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const businessReviewQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  businessId: z.string().uuid().optional(),
});

export const updateWorkingHoursSchema = z.array(z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime:  z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  isClosed:  z.boolean().default(false),
}));

export type CreateBusinessCategoryInput = z.infer<typeof createBusinessCategorySchema>;
export type UpdateBusinessCategoryInput = z.infer<typeof updateBusinessCategorySchema>;
export type CreateBusinessInput         = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput         = z.infer<typeof updateBusinessSchema>;
export type VerifyBusinessInput         = z.infer<typeof verifyBusinessSchema>;
export type BusinessListQuery           = z.infer<typeof businessListQuerySchema>;
export type CreateBusinessProductInput  = z.infer<typeof createBusinessProductSchema>;
export type CreateBusinessServiceInput  = z.infer<typeof createBusinessServiceItemSchema>;
export type UpdateWorkingHoursInput     = z.infer<typeof updateWorkingHoursSchema>;
