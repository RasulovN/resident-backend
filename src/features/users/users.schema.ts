import { z } from 'zod';

// Telegram-style username (admin-assignable): starts with a letter, 3-32 chars,
// no trailing underscore, must not end with "bot".
const adminUsername = z.string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/, 'Username harf bilan boshlanib, 3-32 belgidan iborat bo\'lsin')
  .refine((v) => !v.endsWith('_'), 'Username pastki chiziq bilan tugay olmaydi')
  .refine((v) => !/bot$/i.test(v), 'Username "bot" bilan tugay olmaydi');

// An empty / whitespace-only username means "no username" — coerce it to null so
// editing an account that has no username (e.g. a plain status change in the admin
// panel, where the form submits every field) does not trip the strict regex above.
const emptyToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v;

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  username: z.preprocess(emptyToNull, adminUsername.nullish()),
  phone: z.string().max(32).optional(),
  isPlatformAdmin: z.boolean().default(false),
  status: z.enum(['pending', 'active', 'suspended']).default('active'),
});

export const adminUpdateUserSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  username: z.preprocess(emptyToNull, adminUsername.nullish()),
  phone: z.string().max(32).nullable().optional(),
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  isPlatformAdmin: z.boolean().optional(),
});

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
