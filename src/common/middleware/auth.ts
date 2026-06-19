import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error';
import { ACCESS_COOKIE } from '../utils/cookies';
import { verifyAccessToken } from '../utils/tokens';

// Populates request.authUser from the access-token cookie. Throws if missing/invalid.
export async function authGuard(request: FastifyRequest, _reply: FastifyReply) {
  const cookieToken = request.cookies?.[ACCESS_COOKIE];
  const bearerToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = cookieToken ?? bearerToken;
  if (!token) {
    throw AppError.unauthorized('Authentication required');
  }
  try {
    const payload = await verifyAccessToken(token);
    request.authUser = { id: payload.sub, isPlatformAdmin: payload.isPlatformAdmin };
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
}

// Requires the authenticated user to be a platform admin.
export async function platformAdminGuard(request: FastifyRequest, reply: FastifyReply) {
  await authGuard(request, reply);
  if (!request.authUser?.isPlatformAdmin) {
    throw AppError.forbidden('Platform admin access required');
  }
}
