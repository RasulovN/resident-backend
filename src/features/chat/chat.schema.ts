import { z } from 'zod';

export const createRoomSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const updateRoomSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  isLocked: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const sendMessageSchema = z.object({
  kind: z.enum(['text', 'image', 'file', 'audio']).default('text'),
  body: z.string().max(4000).default(''),
  fileUrl: z.string().url().optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  mimeType: z.string().max(150).optional().nullable(),
  durationSec: z.number().int().nonnegative().optional().nullable(),
  replyToId: z.string().uuid().optional().nullable(),
}).refine(
  (d) => (d.kind === 'text' ? d.body.trim().length > 0 : !!d.fileUrl),
  { message: 'Message must have text or an attachment' },
);

export const editMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const listMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime().optional(), // ISO cursor: fetch messages older than this
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
