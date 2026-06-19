import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import { AppError } from '../../common/errors/app-error';
import { env } from '../../config/env';
import * as service from './billing.service';
import * as payme from './payme.service';

const initiateSchema = z.object({
  planId: z.string().uuid(),
  cardNumber: z.string().min(16).max(19),
  expire: z.string().regex(/^\d{2}\/\d{2}$/, 'Format: MM/YY'),
});

const confirmSchema = z.object({
  planId: z.string().uuid(),
  cardToken: z.string().min(1),
  otp: z.string().min(4).max(8),
  cardMasked: z.string().optional().default(''),
});

/**
 * POST /api/billing/initiate
 * Tokenize card → send OTP to cardholder's phone
 */
export async function initiateHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = initiateSchema.parse(request.body);
  const result = await service.initiatePayment({
    organizationId: request.organizationId!,
    planId: body.planId,
    cardNumber: body.cardNumber,
    expire: body.expire,
  });
  return reply.send(ok(result));
}

/**
 * POST /api/billing/confirm
 * Verify OTP → pay → activate subscription
 */
export async function confirmHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = confirmSchema.parse(request.body);
  const result = await service.confirmPayment({
    organizationId: request.organizationId!,
    planId: body.planId,
    cardToken: body.cardToken,
    otp: body.otp,
    cardMasked: body.cardMasked,
  });
  return reply.send(ok(result));
}

/**
 * GET /api/billing/transactions
 * List payment history for this org
 */
export async function transactionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const list = await service.listTransactions(request.organizationId!);
  return reply.send(ok(list));
}

/**
 * POST /api/billing/payme/merchant
 * Payme Merchant API — Payme calls this endpoint for transaction lifecycle events.
 * Auth: Basic base64(merchant_id:key) — we validate it.
 */
export async function paymeWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  // Validate Payme auth
  const authHeader = request.headers.authorization ?? '';
  const expectedKey = env.PAYME_MERCHANT_KEY ?? '';
  const expectedId = env.PAYME_MERCHANT_ID ?? '';

  // Payme sends: "Basic base64(merchant_id:key)"
  const decoded = Buffer.from(authHeader.replace(/^Basic /, ''), 'base64').toString();
  const [, key] = decoded.split(':');

  if (!key || key !== expectedKey) {
    return reply.status(200).send({
      id: null,
      error: { code: -32504, message: 'Insufficient privilege', data: null },
    });
  }

  const body = request.body as { method?: string; params?: Record<string, unknown>; id?: number };
  const method = body.method ?? '';
  const params = body.params ?? {};
  const rpcId = body.id ?? 0;

  try {
    const result = await handleMerchantMethod(method, params, expectedId);
    return reply.send({ id: rpcId, result });
  } catch (err) {
    const e = err as { code?: number; message?: string };
    return reply.send({
      id: rpcId,
      error: { code: e.code ?? -32400, message: e.message ?? 'Error', data: null },
    });
  }
}

async function handleMerchantMethod(
  method: string,
  params: Record<string, unknown>,
  _merchantId: string,
): Promise<Record<string, unknown>> {
  switch (method) {
    case 'CheckPerformTransaction': {
      // Verify order_id exists and amount is correct
      const account = params['account'] as Record<string, unknown> | undefined;
      const orderId = account?.['order_id'] as string | undefined;
      if (!orderId) return { allow: false };
      // For now, allow all (in production, validate against payment_transactions)
      return { allow: true };
    }

    case 'CreateTransaction': {
      return { create_time: Date.now(), transaction: params['id'], state: 1 };
    }

    case 'PerformTransaction': {
      return { perform_time: Date.now(), transaction: params['id'], state: 2 };
    }

    case 'CancelTransaction': {
      return { cancel_time: Date.now(), transaction: params['id'], state: -1, reason: params['reason'] ?? 1 };
    }

    case 'CheckTransaction': {
      return { create_time: Date.now(), perform_time: 0, cancel_time: 0, transaction: params['id'], state: 1, reason: null };
    }

    case 'GetStatement': {
      return { transactions: [] };
    }

    default:
      throw { code: -32601, message: 'Method not found' };
  }
}
