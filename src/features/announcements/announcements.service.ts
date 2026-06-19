import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { announcements, type NewAnnouncement } from './announcements.model';
import { users } from '../users/users.model';

const cols = {
  id: announcements.id,
  title: announcements.title,
  body: announcements.body,
  priority: announcements.priority,
  targetType: announcements.targetType,
  targetOrgIds: announcements.targetOrgIds,
  status: announcements.status,
  publishedAt: announcements.publishedAt,
  createdById: announcements.createdById,
  createdAt: announcements.createdAt,
};

export async function listAnnouncements(status?: 'draft' | 'published') {
  const rows = await db
    .select({
      ...cols,
      creatorEmail: users.email,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.createdById, users.id))
    .where(status ? eq(announcements.status, status) : undefined)
    .orderBy(desc(announcements.createdAt));

  return rows;
}

export async function listPublishedAnnouncements() {
  return listAnnouncements('published');
}

export async function createAnnouncement(
  input: Pick<NewAnnouncement, 'title' | 'body' | 'priority' | 'targetType' | 'targetOrgIds'>,
  createdById: string,
) {
  const [row] = await db
    .insert(announcements)
    .values({ ...input, createdById, status: 'draft' })
    .returning(cols);
  return row!;
}

export async function publishAnnouncement(id: string) {
  const [row] = await db
    .update(announcements)
    .set({ status: 'published', publishedAt: new Date() })
    .where(eq(announcements.id, id))
    .returning(cols);
  if (!row) throw AppError.notFound('Announcement not found');
  return row;
}

export async function deleteAnnouncement(id: string) {
  const [deleted] = await db
    .delete(announcements)
    .where(eq(announcements.id, id))
    .returning({ id: announcements.id });
  if (!deleted) throw AppError.notFound('Announcement not found');
}

export async function getAnnouncementStats() {
  const [total] = await db.select({ value: sql<number>`count(*)::int` }).from(announcements);
  const [published] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(announcements)
    .where(eq(announcements.status, 'published'));
  const [draft] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(announcements)
    .where(eq(announcements.status, 'draft'));

  return {
    total: total?.value ?? 0,
    published: published?.value ?? 0,
    draft: draft?.value ?? 0,
  };
}
