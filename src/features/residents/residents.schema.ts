import { z } from 'zod';

export const createResidentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  phone2: z.string().max(20).optional(),
  email: z.string().email().max(200).optional(),
  passportSeries: z.string().max(10).optional(),
  passportNumber: z.string().max(20).optional(),
  pinfl: z.string().max(20).optional(),
  birthDate: z.string().datetime({ offset: true }).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  educationLevel: z.string().max(100).optional(),
  occupation: z.string().max(200).optional(),
  employmentStatus: z
    .enum(['employed', 'unemployed', 'self_employed', 'student', 'pensioner', 'housewife', 'other'])
    .optional(),
  socialStatus: z.string().max(200).optional(),
  languages: z.array(z.string()).optional(),
  digitalSkillLevel: z.string().max(50).optional(),
  disabilityType: z.string().max(200).optional(),
  disabilityNotes: z.string().max(500).optional(),
  hobbies: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  happinessScore: z.number().int().min(1).max(10).optional(),
  hasVehicle: z.boolean().optional(),
  householdId: z.string().uuid().optional(),
  apartmentId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'relocated', 'deceased']).optional(),
  registeredAt: z.string().datetime({ offset: true }).optional(),
});

export const updateResidentSchema = createResidentSchema.partial();

export const residentFilterSchema = z.object({
  search: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  status: z.enum(['active', 'inactive', 'relocated', 'deceased']).optional(),
  employmentStatus: z
    .enum(['employed', 'unemployed', 'self_employed', 'student', 'pensioner', 'housewife', 'other'])
    .optional(),
  householdId: z.string().uuid().optional(),
  apartmentId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  ageMin: z.coerce.number().int().min(0).optional(),
  ageMax: z.coerce.number().int().max(150).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateResidentInput = z.infer<typeof createResidentSchema>;
export type UpdateResidentInput = z.infer<typeof updateResidentSchema>;
export type ResidentFilterInput = z.infer<typeof residentFilterSchema>;
