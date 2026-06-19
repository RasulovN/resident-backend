import { z } from 'zod';

// Security: strong-password policy — min 8 chars with at least one lowercase
// letter, one uppercase letter and one digit.
export const passwordRule = z
  .string()
  .min(8, 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak')
  .max(128, 'Parol juda uzun')
  .regex(/[a-z]/, 'Parolda kamida bitta kichik harf bo‘lishi kerak')
  .regex(/[A-Z]/, 'Parolda kamida bitta katta harf bo‘lishi kerak')
  .regex(/[0-9]/, 'Parolda kamida bitta raqam bo‘lishi kerak');

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordRule,
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().max(32).optional(),
  // Consent to Terms of Use & Privacy Policy is mandatory to register.
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Foydalanish shartlari va maxfiylik siyosatiga rozilik majburiy' }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordRule,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
