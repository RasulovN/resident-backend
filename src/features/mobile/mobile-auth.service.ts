import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { db } from '../../db/client';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/app-error';
import { generateOpaqueToken, hashToken, signAccessToken } from '../../common/utils/tokens';
import { recordAudit } from '../../common/utils/audit';
import { users } from '../users/users.model';
import { refreshTokens } from '../auth/auth.model';
import { phoneOtps, mobileProfiles } from './mobile-auth.model';
import { residents, residentRelocations } from '../residents/residents.model';

const OTP_TTL_MS = 1000 * 60 * 5; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendSmsViaEskiz(phone: string, message: string): Promise<void> {
  const shouldSendReal = env.SEND_REAL_SMS || env.NODE_ENV === 'production';
  if (!shouldSendReal || !env.ESKIZ_TOKEN) {
    console.log(`[DEV SMS] To: ${phone} | Message: ${message}`);
    return;
  }

  const response = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.ESKIZ_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mobile_phone: phone,
      message,
      from: env.ESKIZ_FROM || '4546',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[Eskiz SMS] Failed to send:', errText);
    throw new AppError('INTERNAL', 'SMS yuborishda xatolik yuz berdi');
  }
}

export async function sendOtp(phone: string): Promise<{ message: string; dev_code?: string }> {
  // Clean up expired OTPs for this phone
  await db.delete(phoneOtps).where(
    and(eq(phoneOtps.phone, phone), lt(phoneOtps.expiresAt, new Date()))
  );

  const code = generateOtpCode();
  await db.insert(phoneOtps).values({
    phone,
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  const message = `Resident ilovasiga kirish uchun tasdiqlash kodi: ${code}. Hech kimga bermang!`;
  await sendSmsViaEskiz(phone, message);

  const realSmsSent = (env.SEND_REAL_SMS || env.NODE_ENV === 'production') && !!env.ESKIZ_TOKEN;
  return {
    message: 'OTP kod yuborildi',
    ...(!realSmsSent ? { dev_code: code } : {}),
  };
}

export async function verifyOtp(
  phone: string,
  code: string,
  ctx: { userAgent?: string; ip?: string; device?: Record<string, unknown> },
): Promise<{ accessToken: string; refreshToken: string; profile: Record<string, unknown>; isNewUser: boolean }> {
  const otpRecord = await db.query.phoneOtps.findFirst({
    where: and(
      eq(phoneOtps.phone, phone),
      eq(phoneOtps.verified, false),
      gt(phoneOtps.expiresAt, new Date()),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  if (!otpRecord) {
    throw AppError.badRequest('OTP kod topilmadi yoki muddati tugagan');
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    throw AppError.badRequest('Juda ko\'p urinish. Yangi kod so\'rang');
  }

  if (otpRecord.code !== code) {
    await db.update(phoneOtps)
      .set({ attempts: otpRecord.attempts + 1 })
      .where(eq(phoneOtps.id, otpRecord.id));
    throw AppError.badRequest('OTP kod noto\'g\'ri');
  }

  // Mark OTP as verified
  await db.update(phoneOtps).set({ verified: true }).where(eq(phoneOtps.id, otpRecord.id));

  // Find or create user
  const placeholderEmail = `${phone}@mobile.resident`;
  let user = await db.query.users.findFirst({ where: eq(users.phone, phone) });
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const [created] = await db.insert(users).values({
      email: placeholderEmail,
      passwordHash: hashToken(generateOpaqueToken()),
      firstName: 'Foydalanuvchi',
      lastName: '',
      phone,
      status: 'active',
      emailVerified: true,
    }).returning();
    user = created!;
  } else if (user.status !== 'active') {
    await db.update(users).set({ status: 'active' }).where(eq(users.id, user.id));
    user.status = 'active';
  }

  // Find or create mobile profile
  let profile = await db.query.mobileProfiles.findFirst({
    where: eq(mobileProfiles.userId, user.id),
  });

  if (!profile) {
    const [created] = await db.insert(mobileProfiles).values({
      userId: user.id,
      phone,
    }).returning();
    profile = created!;
  }

  // Issue tokens
  const accessToken = await signAccessToken({ sub: user.id, isPlatformAdmin: false });
  const refreshToken = generateOpaqueToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });

  await recordAudit({
    userId: user.id,
    action: 'login',
    resource: 'auth',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { channel: 'mobile', device: ctx.device ?? null },
  });

  return { accessToken, refreshToken, profile, isNewUser };
}

export async function getProfile(userId: string) {
  const profile = await db.query.mobileProfiles.findFirst({
    where: eq(mobileProfiles.userId, userId),
  });
  if (!profile) throw AppError.notFound('Profil topilmadi');
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { username: true } });
  return { ...profile, username: user?.username ?? null };
}

/** True if the username is free (case-insensitive). */
export async function isUsernameAvailable(username: string, forUserId?: string): Promise<boolean> {
  const uname = username.toLowerCase();
  const taken = await db.query.users.findFirst({
    where: forUserId ? and(eq(users.username, uname), ne(users.id, forUserId)) : eq(users.username, uname),
    columns: { id: true },
  });
  return !taken;
}

export async function updateProfile(userId: string, data: Partial<{
  firstName: string;
  lastName: string;
  middleName: string;
  passportId: string;
  username: string;
  birthDate: string;
  gender: string;
  avatarUrl: string;
  email: string;
  showPhone: boolean;
  showEmail: boolean;
  termsAccepted: boolean;
  accountType: string;
  organizationName: string;
  inn: string;
  selectedMahallaId: string;
  onboardingCompleted: boolean;
}>) {
  const existing = await db.query.mobileProfiles.findFirst({
    where: eq(mobileProfiles.userId, userId),
  });
  if (!existing) throw AppError.notFound('Profil topilmadi');

  const { email, username, ...profileData } = data;

  const [updated] = await db.update(mobileProfiles)
    .set({
      ...profileData,
      ...(email !== undefined ? { email } : {}),
      birthDate: profileData.birthDate ? new Date(profileData.birthDate) : undefined,
      // Stamp the consent time the first time the user accepts.
      ...(data.termsAccepted === true && !existing.termsAccepted ? { termsAcceptedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(mobileProfiles.userId, userId))
    .returning();

  // Sync name + email + username to users table
  const userUpdates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (data.firstName) userUpdates.firstName = data.firstName;
  if (data.lastName !== undefined) userUpdates.lastName = data.lastName;
  if (email) userUpdates.email = email;
  if (username !== undefined) {
    const uname = username.toLowerCase();
    if (!(await isUsernameAvailable(uname, userId))) {
      throw AppError.conflict('Bu username band');
    }
    userUpdates.username = uname;
  }

  if (Object.keys(userUpdates).length > 1) {
    await db.update(users).set(userUpdates).where(eq(users.id, userId));
  }

  const finalUser = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { username: true } });

  // Bind the user as a resident of their selected mahalla so they appear in
  // that mahalla's admin panel. Changing mahalla relocates the resident record.
  if (data.selectedMahallaId && updated!.firstName && updated!.lastName) {
    await syncResidentMembership(userId, data.selectedMahallaId, updated!);
  }

  return { ...updated!, username: finalUser?.username ?? null };
}

/**
 * Keeps the `residents` table in sync with a mobile user's selected mahalla.
 * - No resident yet  → create one in the chosen mahalla.
 * - Different mahalla → log a relocation and move the resident.
 * - Same mahalla      → refresh name / phone / birthDate.
 * Failures are logged but never block the profile update.
 */
async function syncResidentMembership(
  userId: string,
  mahallaId: string,
  profile: typeof mobileProfiles.$inferSelect,
) {
  try {
    const common = {
      firstName: profile.firstName!,
      lastName: profile.lastName!,
      phone: profile.phone ?? undefined,
      gender: (profile.gender ?? undefined) as 'male' | 'female' | 'other' | undefined,
      birthDate: profile.birthDate ?? undefined,
      updatedAt: new Date(),
    };

    const existing = await db.query.residents.findFirst({
      where: eq(residents.userId, userId),
    });

    if (!existing) {
      await db.insert(residents).values({
        mahallaId,
        userId,
        status: 'active',
        registeredAt: new Date(),
        ...common,
      });
      return;
    }

    if (existing.mahallaId !== mahallaId) {
      await db.insert(residentRelocations).values({
        residentId: existing.id,
        fromMahallaId: existing.mahallaId,
        toMahallaId: mahallaId,
        relocationType: 'mahalla_change',
        status: 'completed',
        relocationDate: new Date(),
      });
    }

    await db.update(residents)
      .set({ mahallaId, status: 'active', ...common })
      .where(eq(residents.id, existing.id));
  } catch (err) {
    console.error('[syncResidentMembership] failed:', err);
  }
}

export async function mobileRefresh(rawToken: string, ctx: { userAgent?: string; ip?: string }) {
  const tokenHash = hashToken(rawToken);
  const record = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, tokenHash),
      eq(refreshTokens.revoked, false),
      gt(refreshTokens.expiresAt, new Date()),
    ),
  });
  if (!record) throw AppError.unauthorized('Refresh token yaroqsiz');

  const user = await db.query.users.findFirst({ where: eq(users.id, record.userId) });
  if (!user || user.status !== 'active') throw AppError.unauthorized('Hisob mavjud emas');

  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, record.id));

  const accessToken = await signAccessToken({ sub: user.id, isPlatformAdmin: false });
  const newRefreshToken = generateOpaqueToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });

  return { accessToken, refreshToken: newRefreshToken };
}
