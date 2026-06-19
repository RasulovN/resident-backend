import type { FastifyReply } from 'fastify';
import { env } from '../../config/env';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const baseOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  domain: env.COOKIE_DOMAIN || undefined,
  path: '/',
} as const;

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions,
    maxAge: env.ACCESS_TOKEN_TTL,
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions,
    maxAge: env.REFRESH_TOKEN_TTL,
  });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { ...baseOptions });
  reply.clearCookie(REFRESH_COOKIE, { ...baseOptions });
}
