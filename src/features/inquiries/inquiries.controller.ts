import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { recordAudit } from '../../common/utils/audit';
import { ok } from '../../common/utils/response';
import { AppError } from '../../common/errors/app-error';
import * as service from './inquiries.service';
import {
  createInquirySchema,
  updateInquirySchema,
  updateStatusSchema,
  addCommentSchema,
  assignSchema,
  extendDeadlineSchema,
  escalateSchema,
  inquiryListQuerySchema,
  reportQuerySchema,
  exportQuerySchema,
} from './inquiries.schema';

const idParam = z.object({ id: z.string().uuid() });

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = inquiryListQuerySchema.parse(request.query);
  const result = await service.listInquiries(request.organizationId!, query);
  return reply.send(ok(result));
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const stats = await service.getStats(request.organizationId!);
  return reply.send(ok(stats));
}

export async function staffHandler(request: FastifyRequest, reply: FastifyReply) {
  const staff = await service.listAssignableStaff(request.organizationId!);
  return reply.send(ok(staff));
}

export async function reportHandler(request: FastifyRequest, reply: FastifyReply) {
  const q = reportQuerySchema.parse(request.query);
  const report = await service.getReport(request.organizationId!, {
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    period: q.period,
  });
  return reply.send(ok(report));
}

export async function exportHandler(request: FastifyRequest, reply: FastifyReply) {
  const q = exportQuerySchema.parse(request.query);
  const rows = await service.listForExport(request.organizationId!, {
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    status: q.status,
    category: q.category,
    priority: q.priority,
  });
  return reply.send(ok(rows));
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const inquiry = await service.getInquiry(request.organizationId!, id);
  return reply.send(ok(inquiry));
}

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createInquirySchema.parse(request.body);
  // Staff-created inquiries are not tied to a resident account by default.
  const result = await service.createInquiry(request.organizationId!, null, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'create',
    resource: 'inquiry',
    resourceId: result.id,
    metadata: { ticketNumber: result.ticketNumber },
  });
  return reply.status(201).send(ok(result));
}

export async function updateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateInquirySchema.parse(request.body);
  const result = await service.updateInquiry(request.organizationId!, id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update',
    resource: 'inquiry',
    resourceId: id,
  });
  return reply.send(ok(result));
}

export async function updateStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = updateStatusSchema.parse(request.body);
  if (body.status === 'RESOLVED' && !body.resolution && !body.comment) {
    throw AppError.badRequest('Hal qilingan deb belgilash uchun javob matni kiriting');
  }
  const result = await service.updateStatus(request.organizationId!, id, request.authUser!.id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'update_status',
    resource: 'inquiry',
    resourceId: id,
    metadata: { status: body.status },
  });
  return reply.send(ok(result));
}

export async function commentHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = addCommentSchema.parse(request.body);
  await service.addComment(request.organizationId!, id, request.authUser!.id, 'staff', body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: body.isInternal ? 'internal_note' : 'comment',
    resource: 'inquiry',
    resourceId: id,
  });
  return reply.status(201).send(ok({ added: true }));
}

export async function assignHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = assignSchema.parse(request.body);
  const result = await service.assignInquiry(request.organizationId!, id, request.authUser!.id, body.assignedToId);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'assign',
    resource: 'inquiry',
    resourceId: id,
    metadata: { assignedToId: body.assignedToId },
  });
  return reply.send(ok(result));
}

export async function extendHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = extendDeadlineSchema.parse(request.body);
  const result = await service.extendDeadline(request.organizationId!, id, request.authUser!.id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'extend_deadline',
    resource: 'inquiry',
    resourceId: id,
    metadata: { additionalDays: body.additionalDays },
  });
  return reply.send(ok(result));
}

export async function escalateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = idParam.parse(request.params);
  const body = escalateSchema.parse(request.body);
  const result = await service.escalateInquiry(request.organizationId!, id, request.authUser!.id, body);
  await recordAudit({
    organizationId: request.organizationId,
    userId: request.authUser!.id,
    action: 'escalate',
    resource: 'inquiry',
    resourceId: id,
  });
  return reply.send(ok(result));
}
