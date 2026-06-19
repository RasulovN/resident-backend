import { z } from 'zod';

// Add a member by email. If the user doesn't exist yet, a pending account is
// created and an invite is emailed.
export const addMemberSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  // If provided, user is created with this password and activated immediately
  password: z.string().min(8).max(128).optional(),
  roleIds: z.array(z.string().uuid()).default([]),
});

export const updateMemberSchema = z.object({
  status: z.enum(['invited', 'active', 'suspended']).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
