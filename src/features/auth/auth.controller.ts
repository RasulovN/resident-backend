import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '../../common/utils/cookies';
import { paginationSchema } from '../../common/utils/pagination';
import { ok } from '../../common/utils/response';
import { organizationMembers } from '../members/members.model';
import { organizations } from '../organizations/organizations.model';
import { users } from '../users/users.model';
import { adminGetUserActivity } from '../admin/admin.service';
import * as authService from './auth.service';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schema';

function ctxFrom(request: FastifyRequest) {
  return { userAgent: request.headers['user-agent'], ip: request.ip };
}

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(request.body);
  const result = await authService.register(body);
  return reply.status(201).send(ok(result));
}

export async function verifyEmailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { token } = verifyEmailSchema.parse(request.body);
  await authService.verifyEmail(token);
  return reply.send(ok({ verified: true }));
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = loginSchema.parse(request.body);
  const { user, accessToken, refreshToken } = await authService.login(body, ctxFrom(request));
  setAuthCookies(reply, accessToken, refreshToken);
  return reply.send(ok({ user }));
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const raw = request.cookies?.[REFRESH_COOKIE];
  if (!raw) throw AppError.unauthorized('No refresh token');
  const { user, accessToken, refreshToken } = await authService.refresh(raw, ctxFrom(request));
  setAuthCookies(reply, accessToken, refreshToken);
  return reply.send(ok({ user }));
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  await authService.logout(request.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(reply);
  return reply.send(ok({ loggedOut: true }));
}

export async function forgotPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { email } = forgotPasswordSchema.parse(request.body);
  const result = await authService.forgotPassword(email);
  // Always respond the same way (do not reveal whether the email exists).
  return reply.send(ok({ sent: true, ...(result.devToken ? { devToken: result.devToken } : {}) }));
}

export async function resetPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { token, password } = resetPasswordSchema.parse(request.body);
  await authService.resetPassword(token, password);
  return reply.send(ok({ reset: true }));
}

export async function meActivityHandler(request: FastifyRequest, reply: FastifyReply) {
  const pagination = paginationSchema.parse(request.query);
  return reply.send(await adminGetUserActivity(request.authUser!.id, pagination));
}

// Returns the current user plus the organizations they belong to.
export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.authUser!.id;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw AppError.unauthorized();

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logoUrl: organizations.logoUrl,
      status: organizations.status,
      subscriptionStatus: organizations.subscriptionStatus,
      currentPeriodEnd: organizations.currentPeriodEnd,
      memberStatus: organizationMembers.status,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));

  return reply.send(ok({ user: authService.sanitizeUser(user), organizations: orgs }));
}
