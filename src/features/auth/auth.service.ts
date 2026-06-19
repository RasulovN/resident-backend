import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/app-error';
import { hashPassword, verifyPassword } from '../../common/utils/password';
import { sendMail } from '../../common/utils/mailer';
import { recordAudit } from '../../common/utils/audit';
import {
  generateOpaqueToken,
  hashToken,
  signAccessToken,
} from '../../common/utils/tokens';
import { users } from '../users/users.model';
import { refreshTokens, verificationTokens } from './auth.model';
import type { LoginInput, RegisterInput } from './auth.schema';

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const RESET_TTL_MS = 1000 * 60 * 60; // 1h

type TokenContext = { userAgent?: string; ip?: string };

export async function register(input: RegisterInput) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) throw AppError.conflict('Email already registered');

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      status: 'pending',
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    })
    .returning();

  const verificationToken = await issueVerificationEmail(user!.id, user!.email);
  // In development with the mock mailer, expose the token so the frontend can show a direct verify link
  return {
    id: user!.id,
    email: user!.email,
    ...(env.NODE_ENV === 'development' ? { verificationToken } : {}),
  };
}

async function issueVerificationEmail(userId: string, email: string): Promise<string> {
  const token = generateOpaqueToken();
  await db.insert(verificationTokens).values({
    userId,
    type: 'email_verify',
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  });
  const verifyUrl = `${env.WEB_URL}/uz/verify-email?token=${token}`;
  await sendMail(
    email,
    'Email manzilingizni tasdiqlang',
    'Mahalla OS tizimida ro‘yxatdan o‘tganingiz uchun rahmat. Hisobingizni faollashtirish '
      + 'uchun quyidagi tugmani bosing. Havola 24 soat amal qiladi.',
    { url: verifyUrl, label: 'Email manzilini tasdiqlash' },
  );
  return token;
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const record = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.tokenHash, tokenHash),
      eq(verificationTokens.type, 'email_verify'),
    ),
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest('Invalid or expired token');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ status: 'active', emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, record.userId));
    await tx
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, record.id));
  });
}

export async function login(input: LoginInput, ctx: TokenContext) {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (!user) throw AppError.unauthorized('Invalid credentials');

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) throw AppError.unauthorized('Invalid credentials');

  if (user.status === 'pending') throw AppError.forbidden('Email not verified');
  if (user.status === 'suspended') throw AppError.forbidden('Account suspended');

  const tokens = await issueTokens(user.id, user.isPlatformAdmin, ctx);
  await recordAudit({
    userId: user.id,
    action: 'login',
    resource: 'auth',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { channel: 'web' },
  });
  return { user: sanitizeUser(user), ...tokens };
}

export async function issueTokens(
  userId: string,
  isPlatformAdmin: boolean,
  ctx: TokenContext,
) {
  const accessToken = await signAccessToken({ sub: userId, isPlatformAdmin });
  const refreshToken = generateOpaqueToken();
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });
  return { accessToken, refreshToken };
}

export async function refresh(rawToken: string, ctx: TokenContext) {
  const tokenHash = hashToken(rawToken);
  const record = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, tokenHash),
      eq(refreshTokens.revoked, false),
      gt(refreshTokens.expiresAt, new Date()),
    ),
  });
  if (!record) throw AppError.unauthorized('Invalid refresh token');

  const user = await db.query.users.findFirst({ where: eq(users.id, record.userId) });
  if (!user || user.status !== 'active') throw AppError.unauthorized('Account unavailable');

  // rotate: revoke the used token, issue a fresh pair
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, record.id));
  const tokens = await issueTokens(user.id, user.isPlatformAdmin, ctx);
  return { user: sanitizeUser(user), ...tokens };
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.tokenHash, hashToken(rawToken)));
}

export async function forgotPassword(email: string): Promise<{ devToken?: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Do not reveal whether the email exists.
  if (!user) return {};

  const token = generateOpaqueToken();
  await db.insert(verificationTokens).values({
    userId: user.id,
    type: 'password_reset',
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });

  const resetUrl = `${env.WEB_URL}/uz/reset-password?token=${token}`;
  await sendMail(
    email,
    'Parolni tiklash',
    'Hisobingiz uchun parolni tiklash so‘rovi qabul qilindi. Yangi parol o‘rnatish uchun '
      + 'quyidagi tugmani bosing. Havola 1 soat amal qiladi.\n'
      + 'Agar bu so‘rovni siz yubormagan bo‘lsangiz, ushbu xabarni e‘tiborsiz qoldiring — '
      + 'parolingiz o‘zgarmaydi.',
    { url: resetUrl, label: 'Parolni tiklash' },
  );

  // In development expose the token so the flow can be tested without real SMTP.
  return env.NODE_ENV === 'development' ? { devToken: token } : {};
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const record = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.tokenHash, tokenHash),
      eq(verificationTokens.type, 'password_reset'),
    ),
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest('Invalid or expired token');
  }

  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));
    await tx
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, record.id));
    // revoke all sessions on password change
    await tx
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, record.userId));
  });
}

export function sanitizeUser(user: typeof users.$inferSelect) {
  const { passwordHash, ...safe } = user;
  void passwordHash;
  return safe;
}
