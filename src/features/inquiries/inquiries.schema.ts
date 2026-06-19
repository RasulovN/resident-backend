import { z } from 'zod';

export const INQUIRY_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'NEEDS_INFO',
  'ESCALATED',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
] as const;

export const INQUIRY_CATEGORIES = [
  'COMPLAINT',
  'APPLICATION',
  'SUGGESTION',
  'SOCIAL_AID',
  'UTILITY',
  'INFRASTRUCTURE',
  'SECURITY',
  'OTHER',
] as const;

export const INQUIRY_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const attachmentSchema = z.object({
  url: z.string().min(1).max(1000),
  name: z.string().min(1).max(300),
  kind: z.enum(['image', 'file']).default('file'),
  mimeType: z.string().max(150).optional(),
  size: z.number().int().nonnegative().optional(),
});

// ─── Create (resident or staff) ────────────────────────────────────────────────

export const createInquirySchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  category: z.enum(INQUIRY_CATEGORIES).default('COMPLAINT'),
  priority: z.enum(INQUIRY_PRIORITIES).default('MEDIUM'),
  location: z.string().max(500).optional(),
  contactPhone: z.string().max(32).optional(),
  isAnonymous: z.boolean().default(false),
  attachments: z.array(attachmentSchema).max(10).default([]),
});

// ─── Staff actions ──────────────────────────────────────────────────────────────

export const updateStatusSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
  /** Public comment shown to the applicant explaining the change */
  comment: z.string().max(5000).optional(),
  /** Final answer — required (by the controller) when status is RESOLVED */
  resolution: z.string().max(5000).optional(),
});

export const addCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  /** Internal notes are visible only to staff */
  isInternal: z.boolean().default(false),
  attachments: z.array(attachmentSchema).max(10).default([]),
});

export const assignSchema = z.object({
  assignedToId: z.string().uuid().nullable(),
});

export const extendDeadlineSchema = z.object({
  /** Extra calendar days added to the review window (legal max: +30 per step) */
  additionalDays: z.number().int().min(1).max(30),
  /** Reason for the delay — sent verbatim to the applicant, required by law */
  reason: z.string().min(5).max(2000),
});

export const escalateSchema = z.object({
  reason: z.string().min(5).max(2000),
});

export const updateInquirySchema = z.object({
  category: z.enum(INQUIRY_CATEGORIES).optional(),
  priority: z.enum(INQUIRY_PRIORITIES).optional(),
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  location: z.string().max(500).optional(),
});

export const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export const inquiryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(INQUIRY_STATUSES).optional(),
  category: z.enum(INQUIRY_CATEGORIES).optional(),
  priority: z.enum(INQUIRY_PRIORITIES).optional(),
  assignedToId: z.string().uuid().optional(),
  escalated: z.coerce.boolean().optional(),
  overdue: z.coerce.boolean().optional(),
  sort: z.enum(['recent', 'oldest', 'due', 'priority']).default('recent'),
});

export const residentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(INQUIRY_STATUSES).optional(),
});

export const reportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  period: z.enum(['day', 'week', 'month']).default('month'),
});

export const exportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.enum(INQUIRY_STATUSES).optional(),
  category: z.enum(INQUIRY_CATEGORIES).optional(),
  priority: z.enum(INQUIRY_PRIORITIES).optional(),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type ExtendDeadlineInput = z.infer<typeof extendDeadlineSchema>;
export type EscalateInput = z.infer<typeof escalateSchema>;
export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>;
export type RateInput = z.infer<typeof rateSchema>;
export type InquiryListQuery = z.infer<typeof inquiryListQuerySchema>;
export type ResidentListQuery = z.infer<typeof residentListQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
