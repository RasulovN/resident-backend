import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^998[0-9]{9}$/, 'Phone must be in format 998XXXXXXXXX'),
});

export const deviceInfoSchema = z
  .object({
    platform: z.string().max(40).optional(),
    model: z.string().max(120).optional(),
    osVersion: z.string().max(60).optional(),
    appVersion: z.string().max(40).optional(),
  })
  .optional();

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^998[0-9]{9}$/, 'Phone must be in format 998XXXXXXXXX'),
  code: z.string().length(6),
  device: deviceInfoSchema,
});

// Telegram-style username: 3-32 chars, letters/digits/underscore, must start with
// a letter, no trailing underscore, and (for people) must not end with "bot".
export const usernameRule = z.string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/, 'Username harf bilan boshlanib, 3-32 ta harf/raqam/_ bo\'lishi kerak')
  .refine((v) => !v.endsWith('_'), 'Username pastki chiziq bilan tugay olmaydi')
  .refine((v) => !/bot$/i.test(v), 'Username "bot" bilan tugay olmaydi');

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  middleName: z.string().max(80).optional(),
  passportId: z.string().max(40).optional(),
  username: usernameRule.optional(),
  showPhone: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
  birthDate: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  avatarUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  accountType: z.enum(['individual', 'legal']).optional(),
  organizationName: z.string().max(200).optional(),
  inn: z.string().max(20).optional(),
  selectedMahallaId: z.string().uuid().optional(),
  onboardingCompleted: z.boolean().optional(),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
