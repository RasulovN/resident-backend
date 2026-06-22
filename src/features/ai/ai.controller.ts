import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import * as ai from './ai.service';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1),
  stream: z.boolean().optional(),
});

const analyzeSchema = z.object({
  reportType: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  locale: z.string().optional(),
});

const forecastSchema = z.object({
  metric: z.string().min(1),
  horizon: z.number().int().positive().max(36).optional(),
  locale: z.string().optional(),
});

export async function statusHandler(_request: FastifyRequest, reply: FastifyReply) {
  const status = await ai.getStatus();
  return reply.send(ok(status));
}

export async function chatHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = chatSchema.parse(request.body);
  const orgId = request.organizationId!;
  // System prompt is added inside the service; pass through only the conversation.
  const messages = body.messages.filter((m) => m.role !== 'system');

  // Non-streaming fallback.
  if (!body.stream) {
    const reply_text = await ai.chatWithTools(orgId, messages);
    return reply.send(ok({ reply: reply_text, model: (await ai.getStatus()).model }));
  }

  // Server-Sent Events stream. Take over the raw socket so Fastify doesn't
  // try to serialize a body.
  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const abort = new AbortController();
  request.raw.on('close', () => abort.abort());

  try {
    for await (const delta of ai.chatStreamWithTools(orgId, messages, abort.signal)) {
      raw.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    raw.write('data: [DONE]\n\n');
  } catch (err) {
    raw.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  } finally {
    raw.end();
  }
}

export async function analyzeHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = analyzeSchema.parse(request.body);
  const result = await ai.analyzeReport(request.organizationId!, body);
  return reply.send(ok(result));
}

export async function forecastHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = forecastSchema.parse(request.body);
  const result = await ai.forecast(request.organizationId!, body);
  return reply.send(ok(result));
}

export async function anomaliesHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await ai.detectAnomalies(request.organizationId!);
  return reply.send(ok(result));
}
