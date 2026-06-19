import { z } from 'zod';

const displayConfigSchema = z
  .object({
    defaultView: z.enum(['table', 'list', 'card']).optional(),
  })
  .default({});

export const createMenuSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().max(60).optional(),
  path: z.string().max(200).optional(),
  type: z.enum(['group', 'static_module', 'dynamic_entity', 'link']).default('group'),
  parentId: z.string().uuid().nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  displayConfig: displayConfigSchema,
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const updateMenuSchema = createMenuSchema.partial();

export const reorderMenuSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
