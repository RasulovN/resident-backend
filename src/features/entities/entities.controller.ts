import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import * as service from './entities.service';
import {
  createEntitySchema,
  createFieldSchema,
  createRecordSchema,
  listRecordsQuerySchema,
  updateEntitySchema,
  updateFieldSchema,
  updateRecordSchema,
} from './entities.schema';

const entityParam = z.object({ entityId: z.string().uuid() });
const fieldParam = z.object({ entityId: z.string().uuid(), fieldId: z.string().uuid() });
const recordParam = z.object({ entityId: z.string().uuid(), recordId: z.string().uuid() });

// ----- Definitions -----

export async function listEntitiesHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(ok(await service.listEntities(request.organizationId!)));
}

export async function getEntityHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId } = entityParam.parse(request.params);
  return reply.send(ok(await service.getEntity(request.organizationId!, entityId)));
}

export async function createEntityHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createEntitySchema.parse(request.body);
  const entity = await service.createEntity(request.organizationId!, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'entity',
    resourceId: entity.id,
  });
  return reply.status(201).send(ok(entity));
}

export async function updateEntityHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId } = entityParam.parse(request.params);
  const body = updateEntitySchema.parse(request.body);
  return reply.send(ok(await service.updateEntity(request.organizationId!, entityId, body)));
}

export async function deleteEntityHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId } = entityParam.parse(request.params);
  await service.deleteEntity(request.organizationId!, entityId);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'delete',
    resource: 'entity',
    resourceId: entityId,
  });
  return reply.send(ok({ deleted: true }));
}

// ----- Fields -----

export async function createFieldHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId } = entityParam.parse(request.params);
  const body = createFieldSchema.parse(request.body);
  return reply
    .status(201)
    .send(ok(await service.createField(request.organizationId!, entityId, body)));
}

export async function updateFieldHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId, fieldId } = fieldParam.parse(request.params);
  const body = updateFieldSchema.parse(request.body);
  return reply.send(ok(await service.updateField(request.organizationId!, entityId, fieldId, body)));
}

export async function deleteFieldHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId, fieldId } = fieldParam.parse(request.params);
  await service.deleteField(request.organizationId!, entityId, fieldId);
  return reply.send(ok({ deleted: true }));
}

// ----- Records -----

export async function listRecordsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId } = entityParam.parse(request.params);
  const query = listRecordsQuerySchema.parse(request.query);
  return reply.send(ok(await service.listRecords(request.organizationId!, entityId, query)));
}

export async function createRecordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId } = entityParam.parse(request.params);
  const body = createRecordSchema.parse(request.body);
  const record = await service.createRecord(
    request.organizationId!,
    entityId,
    request.authUser!.id,
    body,
  );
  return reply.status(201).send(ok(record));
}

export async function updateRecordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId, recordId } = recordParam.parse(request.params);
  const body = updateRecordSchema.parse(request.body);
  return reply.send(
    ok(await service.updateRecord(request.organizationId!, entityId, recordId, body)),
  );
}

export async function deleteRecordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId, recordId } = recordParam.parse(request.params);
  await service.deleteRecord(request.organizationId!, entityId, recordId);
  return reply.send(ok({ deleted: true }));
}
