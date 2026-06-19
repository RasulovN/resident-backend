import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { getOffset, paginated } from '../../common/utils/pagination';
import { grantPermissionToOwnerRole } from '../permissions/permissions.service';
import { permissions } from '../permissions/permissions.model';
import {
  entityDefinitions,
  entityFields,
  entityRecords,
  type EntityField,
} from './entities.model';
import type {
  CreateEntityInput,
  CreateFieldInput,
  CreateRecordInput,
  ListRecordsQuery,
  UpdateEntityInput,
  UpdateFieldInput,
  UpdateRecordInput,
} from './entities.schema';

const CRUD = ['create', 'read', 'update', 'delete'] as const;
export const entityPermissionKey = (entityId: string, action: string) =>
  `entity.${entityId}.${action}`;

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entity'
  );
}

// ---------- Definitions ----------

export async function listEntities(organizationId: string) {
  return db.query.entityDefinitions.findMany({
    where: eq(entityDefinitions.organizationId, organizationId),
    orderBy: (e, { asc: a }) => a(e.createdAt),
  });
}

export async function getEntity(organizationId: string, id: string) {
  const entity = await db.query.entityDefinitions.findFirst({
    where: and(eq(entityDefinitions.id, id), eq(entityDefinitions.organizationId, organizationId)),
  });
  if (!entity) throw AppError.notFound('Entity not found');
  const fields = await db.query.entityFields.findMany({
    where: eq(entityFields.entityDefinitionId, id),
    orderBy: [asc(entityFields.sortOrder)],
  });
  return { ...entity, fields };
}

export async function createEntity(organizationId: string, input: CreateEntityInput) {
  const slug = input.slug ?? slugify(input.name);
  const existing = await db.query.entityDefinitions.findFirst({
    where: and(
      eq(entityDefinitions.organizationId, organizationId),
      eq(entityDefinitions.slug, slug),
    ),
  });
  if (existing) throw AppError.conflict('An entity with this slug already exists');

  return db.transaction(async (tx) => {
    const [entity] = await tx
      .insert(entityDefinitions)
      .values({
        organizationId,
        menuId: input.menuId ?? null,
        name: input.name,
        slug,
        description: input.description,
        displayConfig: input.displayConfig,
        supportsArchive: input.supportsArchive,
        supportsStatus: input.supportsStatus,
      })
      .returning();

    // generate dynamic CRUD permissions for this entity
    const created = await tx
      .insert(permissions)
      .values(
        CRUD.map((action) => ({
          key: entityPermissionKey(entity!.id, action),
          description: `${action} ${entity!.name}`,
          scope: 'organization' as const,
          isDynamic: true,
        })),
      )
      .returning();

    // grant them to the org Owner role so the creator can manage records immediately
    for (const perm of created) {
      await grantPermissionToOwnerRole(tx, organizationId, perm.id);
    }

    return entity!;
  });
}

export async function updateEntity(organizationId: string, id: string, input: UpdateEntityInput) {
  await getEntity(organizationId, id);
  const [updated] = await db
    .update(entityDefinitions)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.menuId !== undefined ? { menuId: input.menuId } : {}),
      ...(input.displayConfig !== undefined ? { displayConfig: input.displayConfig } : {}),
      ...(input.supportsArchive !== undefined ? { supportsArchive: input.supportsArchive } : {}),
      ...(input.supportsStatus !== undefined ? { supportsStatus: input.supportsStatus } : {}),
      updatedAt: new Date(),
    })
    .where(eq(entityDefinitions.id, id))
    .returning();
  return updated!;
}

export async function deleteEntity(organizationId: string, id: string) {
  await getEntity(organizationId, id);
  await db.transaction(async (tx) => {
    for (const action of CRUD) {
      await tx.delete(permissions).where(eq(permissions.key, entityPermissionKey(id, action)));
    }
    await tx.delete(entityDefinitions).where(eq(entityDefinitions.id, id)); // fields + records cascade
  });
}

// ---------- Fields ----------

async function assertEntityInOrg(organizationId: string, entityId: string) {
  const entity = await db.query.entityDefinitions.findFirst({
    where: and(
      eq(entityDefinitions.id, entityId),
      eq(entityDefinitions.organizationId, organizationId),
    ),
    columns: { id: true },
  });
  if (!entity) throw AppError.notFound('Entity not found');
}

export async function createField(
  organizationId: string,
  entityId: string,
  input: CreateFieldInput,
) {
  await assertEntityInOrg(organizationId, entityId);
  const existing = await db.query.entityFields.findFirst({
    where: and(eq(entityFields.entityDefinitionId, entityId), eq(entityFields.key, input.key)),
  });
  if (existing) throw AppError.conflict('Field key already exists for this entity');

  const [field] = await db
    .insert(entityFields)
    .values({
      entityDefinitionId: entityId,
      name: input.name,
      key: input.key,
      type: input.type,
      config: input.config,
      sortOrder: input.sortOrder,
      showInList: input.showInList,
    })
    .returning();
  return field!;
}

export async function updateField(
  organizationId: string,
  entityId: string,
  fieldId: string,
  input: UpdateFieldInput,
) {
  await assertEntityInOrg(organizationId, entityId);
  const [updated] = await db
    .update(entityFields)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.showInList !== undefined ? { showInList: input.showInList } : {}),
    })
    .where(and(eq(entityFields.id, fieldId), eq(entityFields.entityDefinitionId, entityId)))
    .returning();
  if (!updated) throw AppError.notFound('Field not found');
  return updated;
}

export async function deleteField(organizationId: string, entityId: string, fieldId: string) {
  await assertEntityInOrg(organizationId, entityId);
  const [deleted] = await db
    .delete(entityFields)
    .where(and(eq(entityFields.id, fieldId), eq(entityFields.entityDefinitionId, entityId)))
    .returning({ id: entityFields.id });
  if (!deleted) throw AppError.notFound('Field not found');
}

// ---------- Records ----------

function validateRecordData(fields: EntityField[], data: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = data[field.key];
    const cfg = field.config ?? {};
    const isEmpty = value === undefined || value === null || value === '';

    if (cfg.required && isEmpty) {
      errors[field.key] = 'Required';
      continue;
    }
    if (isEmpty) continue;

    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) errors[field.key] = 'Must be a number';
        break;
      case 'boolean':
        if (typeof value !== 'boolean') errors[field.key] = 'Must be a boolean';
        break;
      case 'date':
      case 'datetime':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
          errors[field.key] = 'Must be a valid date';
        break;
      case 'select':
        if (cfg.options && !cfg.options.some((o) => o.value === value))
          errors[field.key] = 'Invalid option';
        break;
      case 'multiselect':
        if (!Array.isArray(value)) errors[field.key] = 'Must be a list';
        break;
      default:
        // text/textarea/relation/file/image accept strings
        break;
    }
    cleaned[field.key] = value;
  }

  if (Object.keys(errors).length) {
    throw AppError.badRequest('Record validation failed', errors);
  }
  return cleaned;
}

export async function listRecords(
  organizationId: string,
  entityId: string,
  query: ListRecordsQuery,
) {
  await assertEntityInOrg(organizationId, entityId);

  const conditions = [
    eq(entityRecords.entityDefinitionId, entityId),
    eq(entityRecords.organizationId, organizationId),
    isNull(entityRecords.deletedAt),
  ];
  if (query.status !== 'all') conditions.push(eq(entityRecords.status, query.status));
  if (query.search) {
    conditions.push(sql`${entityRecords.data}::text ILIKE ${`%${query.search}%`}`);
  }
  const where = and(...conditions);

  const rows = await db
    .select()
    .from(entityRecords)
    .where(where)
    .orderBy(desc(entityRecords.createdAt))
    .limit(query.limit)
    .offset(getOffset({ page: query.page, limit: query.limit }));

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(entityRecords)
    .where(where);

  return paginated(rows, total, { page: query.page, limit: query.limit });
}

async function loadFields(entityId: string) {
  return db.query.entityFields.findMany({
    where: eq(entityFields.entityDefinitionId, entityId),
  });
}

export async function createRecord(
  organizationId: string,
  entityId: string,
  createdBy: string,
  input: CreateRecordInput,
) {
  await assertEntityInOrg(organizationId, entityId);
  const fields = await loadFields(entityId);
  const data = validateRecordData(fields, input.data);

  const [record] = await db
    .insert(entityRecords)
    .values({
      entityDefinitionId: entityId,
      organizationId,
      data,
      status: input.status ?? 'active',
      createdBy,
    })
    .returning();
  return record!;
}

async function getRecordInOrg(organizationId: string, entityId: string, recordId: string) {
  const record = await db.query.entityRecords.findFirst({
    where: and(
      eq(entityRecords.id, recordId),
      eq(entityRecords.entityDefinitionId, entityId),
      eq(entityRecords.organizationId, organizationId),
      isNull(entityRecords.deletedAt),
    ),
  });
  if (!record) throw AppError.notFound('Record not found');
  return record;
}

export async function updateRecord(
  organizationId: string,
  entityId: string,
  recordId: string,
  input: UpdateRecordInput,
) {
  const record = await getRecordInOrg(organizationId, entityId, recordId);

  let nextData = record.data;
  if (input.data) {
    const fields = await loadFields(entityId);
    const merged = { ...record.data, ...input.data };
    nextData = validateRecordData(fields, merged);
  }

  const [updated] = await db
    .update(entityRecords)
    .set({
      data: nextData,
      ...(input.status ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(entityRecords.id, recordId))
    .returning();
  return updated!;
}

export async function deleteRecord(organizationId: string, entityId: string, recordId: string) {
  await getRecordInOrg(organizationId, entityId, recordId);
  // soft delete
  await db
    .update(entityRecords)
    .set({ deletedAt: new Date() })
    .where(eq(entityRecords.id, recordId));
}
