import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { sendMail } from '../../common/utils/mailer';
import { hashPassword } from '../../common/utils/password';
import { generateOpaqueToken, hashToken } from '../../common/utils/tokens';
import { verificationTokens } from '../auth/auth.model';
import { memberRoles, roles } from '../roles/roles.model';
import { users } from '../users/users.model';
import { organizationMembers } from './members.model';
import type { AddMemberInput, UpdateMemberInput } from './members.schema';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function listMembers(organizationId: string) {
  const members = await db
    .select({
      id: organizationMembers.id,
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      status: organizationMembers.status,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId));

  // attach roles per member
  const memberIds = members.map((m) => m.id);
  const roleRows = memberIds.length
    ? await db
        .select({
          memberId: memberRoles.memberId,
          roleId: roles.id,
          roleName: roles.name,
        })
        .from(memberRoles)
        .innerJoin(roles, eq(memberRoles.roleId, roles.id))
        .where(inArray(memberRoles.memberId, memberIds))
    : [];

  return members.map((m) => ({
    ...m,
    roles: roleRows.filter((r) => r.memberId === m.id).map((r) => ({ id: r.roleId, name: r.roleName })),
  }));
}

async function assertRolesInOrg(organizationId: string, roleIds: string[]) {
  if (roleIds.length === 0) return;
  const found = await db.query.roles.findMany({
    where: and(eq(roles.organizationId, organizationId), inArray(roles.id, roleIds)),
    columns: { id: true },
  });
  if (found.length !== roleIds.length) {
    throw AppError.badRequest('One or more roles do not belong to this organization');
  }
}

export async function addMember(organizationId: string, invitedBy: string, input: AddMemberInput) {
  await assertRolesInOrg(organizationId, input.roleIds);

  let user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  let isNewUser = false;

  if (!user) {
    const hasProvidedPassword = Boolean(input.password);
    const passwordToUse = input.password ?? generateOpaqueToken();
    [user] = await db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: await hashPassword(passwordToUse),
        firstName: input.firstName ?? input.email.split('@')[0]!,
        lastName: input.lastName ?? '',
        // If admin set a password, activate immediately; otherwise send invite
        status: hasProvidedPassword ? 'active' : 'pending',
        emailVerified: hasProvidedPassword,
      })
      .returning();
    isNewUser = true;
  }

  const existingMembership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, user!.id),
    ),
  });
  if (existingMembership) throw AppError.conflict('User is already a member');

  const member = await db.transaction(async (tx) => {
    // If the new user already has a password set by admin, mark them active
    const memberStatus = isNewUser && !input.password ? 'invited' : 'active';
    const [m] = await tx
      .insert(organizationMembers)
      .values({
        organizationId,
        userId: user!.id,
        status: memberStatus,
        invitedBy,
      })
      .returning();

    if (input.roleIds.length) {
      await tx
        .insert(memberRoles)
        .values(input.roleIds.map((roleId) => ({ memberId: m!.id, roleId })));
    }
    return m!;
  });

  if (isNewUser && !input.password) {
    // Send invite only if admin didn't set a password
    const token = generateOpaqueToken();
    await db.insert(verificationTokens).values({
      userId: user!.id,
      type: 'invite',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    await sendMail(
      input.email,
      "Tizimga taklif qilindingiz",
      `Siz tizimga qo'shildingiz. Parolni o'rnatish uchun token: ${token}`,
    );
  } else if (isNewUser && input.password) {
    // Send a welcome email with the provided credentials
    await sendMail(
      input.email,
      "Tizimga qo'shildingiz",
      `Siz tizimga muvaffaqiyatli qo'shildingiz.\n\nEmail: ${input.email}\nParol: ${input.password}\n\nTizimga kiring va parolingizni o'zgartiring.`,
    );
  }

  return { id: member.id, userId: user!.id, status: member.status, invited: isNewUser };
}

async function getMemberInOrg(organizationId: string, memberId: string) {
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, memberId),
      eq(organizationMembers.organizationId, organizationId),
    ),
  });
  if (!member) throw AppError.notFound('Member not found');
  return member;
}

export async function updateMember(
  organizationId: string,
  memberId: string,
  input: UpdateMemberInput,
) {
  const member = await getMemberInOrg(organizationId, memberId);

  if (input.roleIds) await assertRolesInOrg(organizationId, input.roleIds);

  await db.transaction(async (tx) => {
    if (input.status) {
      await tx
        .update(organizationMembers)
        .set({ status: input.status })
        .where(eq(organizationMembers.id, member.id));
    }
    if (input.roleIds) {
      await tx.delete(memberRoles).where(eq(memberRoles.memberId, member.id));
      if (input.roleIds.length) {
        await tx
          .insert(memberRoles)
          .values(input.roleIds.map((roleId) => ({ memberId: member.id, roleId })));
      }
    }
  });

  return { id: member.id };
}

export async function removeMember(organizationId: string, memberId: string, ownerUserId: string) {
  const member = await getMemberInOrg(organizationId, memberId);
  // never remove the organization owner
  const org = await db.query.organizations.findFirst({
    where: (o, { eq: eqf }) => eqf(o.id, organizationId),
  });
  if (org && member.userId === org.ownerUserId) {
    throw AppError.badRequest('Cannot remove the organization owner');
  }
  void ownerUserId;
  await db.delete(organizationMembers).where(eq(organizationMembers.id, member.id));
}
