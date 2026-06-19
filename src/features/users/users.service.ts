import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { hashPassword } from '../../common/utils/password';
import { getOffset, paginated, type Pagination } from '../../common/utils/pagination';
import { users } from './users.model';
import type { AdminCreateUserInput, AdminUpdateUserInput } from './users.schema';

const publicColumns = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  username: users.username,
  phone: users.phone,
  avatarUrl: users.avatarUrl,
  status: users.status,
  emailVerified: users.emailVerified,
  isPlatformAdmin: users.isPlatformAdmin,
  createdAt: users.createdAt,
};

export async function adminListUsers(pagination: Pagination, search?: string) {
  const where = search
    ? or(ilike(users.email, `%${search}%`), ilike(users.firstName, `%${search}%`), ilike(users.lastName, `%${search}%`), ilike(users.username, `%${search}%`))
    : undefined;

  const rows = await db
    .select(publicColumns)
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pagination.limit)
    .offset(getOffset(pagination));

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(users)
    .where(where);

  return paginated(rows, total, pagination);
}

export async function adminGetUser(id: string) {
  const [user] = await db.select(publicColumns).from(users).where(eq(users.id, id));
  if (!user) throw AppError.notFound('User not found');
  return user;
}

export async function adminCreateUser(input: AdminCreateUserInput) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) throw AppError.conflict('Email already registered');

  const username = input.username?.toLowerCase();
  if (username) {
    const taken = await db.query.users.findFirst({ where: eq(users.username, username), columns: { id: true } });
    if (taken) throw AppError.conflict('Bu username band');
  }

  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      username,
      phone: input.phone,
      status: input.status,
      emailVerified: input.status === 'active',
      isPlatformAdmin: input.isPlatformAdmin,
    })
    .returning(publicColumns);
  return created!;
}

export async function adminUpdateUser(id: string, input: AdminUpdateUserInput) {
  const { username, ...rest } = input;
  const set: Record<string, unknown> = { ...rest, updatedAt: new Date() };

  if (username !== undefined) {
    if (username === null) {
      set.username = null;
    } else {
      const uname = username.toLowerCase();
      const taken = await db.query.users.findFirst({
        where: and(eq(users.username, uname), ne(users.id, id)),
        columns: { id: true },
      });
      if (taken) throw AppError.conflict('Bu username band');
      set.username = uname;
    }
  }

  const [updated] = await db.update(users).set(set).where(eq(users.id, id)).returning(publicColumns);
  if (!updated) throw AppError.notFound('User not found');
  return updated;
}

export async function adminDeleteUser(id: string) {
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  if (!deleted) throw AppError.notFound('User not found');
}
