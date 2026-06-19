import { z } from 'zod';

const viewEnum = z.enum(['table', 'list', 'card']);

const entityDisplayConfigSchema = z
  .object({
    views: z.array(viewEnum).optional(),
    defaultView: viewEnum.optional(),
    columns: z.array(z.string()).optional(),
  })
  .default({ views: ['table'], defaultView: 'table' });

export const createEntitySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes')
    .max(80)
    .optional(),
  description: z.string().max(500).optional(),
  menuId: z.string().uuid().nullable().optional(),
  displayConfig: entityDisplayConfigSchema,
  supportsArchive: z.boolean().default(true),
  supportsStatus: z.boolean().default(true),
});

export const updateEntitySchema = createEntitySchema.partial();

const fieldTypeEnum = z.enum([
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multiselect',
  'relation',
  'file',
  'image',
]);

const fieldConfigSchema = z
  .object({
    required: z.boolean().optional(),
    unique: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    default: z.unknown().optional(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    relationEntityId: z.string().uuid().optional(),
  })
  .default({});

export const createFieldSchema = z.object({
  name: z.string().min(1).max(120),
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'key must be a valid identifier').max(60),
  type: fieldTypeEnum,
  config: fieldConfigSchema,
  sortOrder: z.number().int().default(0),
  showInList: z.boolean().default(true),
});

export const updateFieldSchema = createFieldSchema.partial();

export const createRecordSchema = z.object({
  data: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

export const updateRecordSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

export const listRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive', 'archived', 'all']).default('active'),
  search: z.string().optional(),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
