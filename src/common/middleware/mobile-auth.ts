import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error';
import { verifyAccessToken } from '../utils/tokens';

/** Reads JWT from `Authorization: Bearer <token>` header (mobile-first). */
export async function mobileAuthGuard(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Authentication required');
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    request.authUser = { id: payload.sub, isPlatformAdmin: payload.isPlatformAdmin };
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
}

/** Optional auth — sets authUser if token present, does not throw if absent. */
export async function mobileAuthOptional(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return;
  try {
    const payload = await verifyAccessToken(authHeader.slice(7));
    request.authUser = { id: payload.sub, isPlatformAdmin: payload.isPlatformAdmin };
  } catch {
    // ignore
  }
}

/** Mobile tenant context: reads X-Mahalla-Id header (alias for X-Organization-Id). */
export async function mobileTenantContext(request: FastifyRequest, _reply: FastifyReply) {
  const mahallaId = request.headers['x-mahalla-id'] || request.headers['x-organization-id'];
  if (typeof mahallaId === 'string' && mahallaId.length > 0) {
    request.organizationId = mahallaId;
  }
}
