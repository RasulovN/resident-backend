import { and, count, desc, eq, gt, ilike, inArray, lt, ne, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { wsBroadcast } from '../../common/ws/ws-manager';
import { users } from '../users/users.model';
import { mobileProfiles } from '../mobile/mobile-auth.model';
import { organizations } from '../organizations/organizations.model';
import {
  chatContacts,
  chatMembers,
  chatMessages,
  chatRooms,
  type ChatMember,
  type ChatRoom,
} from './chat.model';

// ─── Shapes returned to clients ───────────────────────────────────────────────

export type MessageKind = 'text' | 'image' | 'file' | 'audio';

export type EnrichedMessage = {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string;
  senderAvatar: string | null;
  kind: MessageKind;
  body: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  durationSec: number | null;
  replyToId: string | null;
  isSystem: boolean;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
};

export type RoomSummary = ChatRoom & {
  memberCount: number;
  lastMessage: { body: string; senderName: string; createdAt: string; isSystem: boolean } | null;
  // Membership info (only when a userId is supplied)
  membership?: { role: ChatMember['role']; isMuted: boolean; isBanned: boolean } | null;
  unreadCount?: number;
  // For DM rooms: the other participant (title/avatarUrl are overridden with theirs).
  peerUserId?: string | null;
};

export type SearchedUser = {
  userId: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  isContact?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Short label for a room's last message when it's an attachment.
function previewText(kind: string | null, body: string): string {
  if (body) return body;
  switch (kind) {
    case 'image': return '📷 Rasm';
    case 'audio': return '🎤 Ovozli xabar';
    case 'file': return '📎 Fayl';
    default: return body;
  }
}

function displayName(first: string | null, last: string | null, fallback = 'Foydalanuvchi'): string {
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name || fallback;
}

/** Resolve a sender's display name + avatar, preferring the richer mobile profile. */
function senderDisplay(row: {
  uFirst: string | null; uLast: string | null; uAvatar: string | null;
  mpFirst: string | null; mpLast: string | null; mpAvatar: string | null;
}): { name: string; avatar: string | null } {
  const hasMp = row.mpFirst || row.mpLast || row.mpAvatar;
  if (hasMp) {
    return { name: displayName(row.mpFirst, row.mpLast), avatar: row.mpAvatar ?? row.uAvatar ?? null };
  }
  return { name: displayName(row.uFirst, row.uLast), avatar: row.uAvatar ?? null };
}

const SENDER_COLUMNS = {
  uFirst: users.firstName, uLast: users.lastName, uAvatar: users.avatarUrl,
  mpFirst: mobileProfiles.firstName, mpLast: mobileProfiles.lastName, mpAvatar: mobileProfiles.avatarUrl,
};

// ─── Rooms ────────────────────────────────────────────────────────────────────

export async function getRoom(roomId: string): Promise<ChatRoom | null> {
  const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId));
  return room ?? null;
}

export async function listRoomsForOrg(orgId: string, userId?: string): Promise<RoomSummary[]> {
  const rooms = await db
    .select()
    .from(chatRooms)
    .where(and(eq(chatRooms.organizationId, orgId), eq(chatRooms.isActive, true)))
    .orderBy(desc(chatRooms.updatedAt));
  return enrichRooms(rooms, userId);
}

/**
 * Unified chat list for a mobile user: every room they belong to (DMs, groups,
 * joined mahalla chats) PLUS the discoverable mahalla community chats of their org.
 */
export async function listRoomsForUser(userId: string, orgId?: string | null): Promise<RoomSummary[]> {
  const memberRoomIds = (
    await db.select({ roomId: chatMembers.roomId }).from(chatMembers).where(eq(chatMembers.userId, userId))
  ).map((r) => r.roomId);

  const idSet = new Set(memberRoomIds);

  // Discoverable mahalla community chats (so users can find & join them).
  if (orgId) {
    const mahallaRooms = await db
      .select({ id: chatRooms.id })
      .from(chatRooms)
      .where(and(eq(chatRooms.organizationId, orgId), eq(chatRooms.type, 'mahalla'), eq(chatRooms.isActive, true)));
    for (const r of mahallaRooms) idSet.add(r.id);
  }

  const ids = [...idSet];
  if (ids.length === 0) return [];

  const rooms = await db
    .select()
    .from(chatRooms)
    .where(and(inArray(chatRooms.id, ids), eq(chatRooms.isActive, true)))
    .orderBy(desc(chatRooms.updatedAt));
  return enrichRooms(rooms, userId);
}

/** Enriched single room for a user (incl. DM peer, membership, unread). */
export async function getRoomForUser(roomId: string, userId: string): Promise<RoomSummary | null> {
  const room = await getRoom(roomId);
  if (!room) return null;
  const [summary] = await enrichRooms([room], userId);
  return summary ?? null;
}

/** Search app users (residents) by username / first / last name. */
export async function searchUsers(query: string, excludeUserId: string, limit = 20): Promise<SearchedUser[]> {
  const q = `%${query.trim()}%`;
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      uFirst: users.firstName, uLast: users.lastName, uAvatar: users.avatarUrl,
      mpFirst: mobileProfiles.firstName, mpLast: mobileProfiles.lastName, mpAvatar: mobileProfiles.avatarUrl,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .innerJoin(mobileProfiles, eq(mobileProfiles.userId, users.id)) // only app (mobile) users
    .where(
      and(
        ne(users.id, excludeUserId),
        or(
          ilike(users.username, q),
          ilike(users.firstName, q),
          ilike(users.lastName, q),
          ilike(mobileProfiles.firstName, q),
          ilike(mobileProfiles.lastName, q),
        ),
      ),
    )
    .limit(limit);

  const contacts = await contactIdSet(excludeUserId);
  return rows.map((r) => {
    const d = senderDisplay(r);
    return {
      userId: r.userId,
      username: r.username,
      name: d.name,
      avatarUrl: d.avatar,
      lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
      isContact: contacts.has(r.userId),
    };
  });
}

export type PublicProfile = SearchedUser & {
  phone: string | null;   // null unless the user enabled showPhone
  email: string | null;   // null unless the user enabled showEmail
};

/** A viewable user profile, honoring the target's phone/email privacy toggles. */
export async function getPublicProfile(targetUserId: string, viewerId: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select({
      userId: users.id,
      username: users.username,
      lastSeenAt: users.lastSeenAt,
      uFirst: users.firstName, uLast: users.lastName, uAvatar: users.avatarUrl,
      mpFirst: mobileProfiles.firstName, mpLast: mobileProfiles.lastName, mpAvatar: mobileProfiles.avatarUrl,
      phone: mobileProfiles.phone, email: mobileProfiles.email,
      showPhone: mobileProfiles.showPhone, showEmail: mobileProfiles.showEmail,
    })
    .from(users)
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, users.id))
    .where(eq(users.id, targetUserId));
  if (!row) return null;

  const d = senderDisplay(row);
  const isSelf = targetUserId === viewerId;
  const contacts = await contactIdSet(viewerId);
  return {
    userId: row.userId,
    username: row.username,
    name: d.name,
    avatarUrl: d.avatar,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    isContact: contacts.has(row.userId),
    // Self always sees own contacts; otherwise respect privacy flags.
    phone: isSelf || row.showPhone ? row.phone ?? null : null,
    email: isSelf || row.showEmail ? row.email ?? null : null,
  };
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function listContacts(userId: string): Promise<SearchedUser[]> {
  const rows = await db
    .select({
      userId: chatContacts.contactUserId,
      username: users.username,
      uFirst: users.firstName, uLast: users.lastName, uAvatar: users.avatarUrl,
      mpFirst: mobileProfiles.firstName, mpLast: mobileProfiles.lastName, mpAvatar: mobileProfiles.avatarUrl,
      lastSeenAt: users.lastSeenAt,
    })
    .from(chatContacts)
    .innerJoin(users, eq(users.id, chatContacts.contactUserId))
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, chatContacts.contactUserId))
    .where(eq(chatContacts.ownerUserId, userId))
    .orderBy(desc(chatContacts.createdAt));
  return rows.map((r) => {
    const d = senderDisplay(r);
    return { userId: r.userId, username: r.username, name: d.name, avatarUrl: d.avatar, lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null, isContact: true };
  });
}

export async function addContact(ownerUserId: string, contactUserId: string): Promise<void> {
  if (ownerUserId === contactUserId) return;
  await db.insert(chatContacts).values({ ownerUserId, contactUserId }).onConflictDoNothing();
}

export async function removeContact(ownerUserId: string, contactUserId: string): Promise<void> {
  await db.delete(chatContacts).where(and(eq(chatContacts.ownerUserId, ownerUserId), eq(chatContacts.contactUserId, contactUserId)));
}

/** Set of contactUserIds the owner has saved (for marking search results). */
export async function contactIdSet(ownerUserId: string): Promise<Set<string>> {
  const rows = await db.select({ id: chatContacts.contactUserId }).from(chatContacts).where(eq(chatContacts.ownerUserId, ownerUserId));
  return new Set(rows.map((r) => r.id));
}

function dmKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}

/** Find or create the 1-to-1 DM room between two users. */
export async function findOrCreateDm(userA: string, userB: string): Promise<ChatRoom> {
  const key = dmKeyFor(userA, userB);
  const [existing] = await db.select().from(chatRooms).where(eq(chatRooms.dmKey, key));
  if (existing) return existing;

  const [room] = await db
    .insert(chatRooms)
    .values({ type: 'dm', dmKey: key, title: '', createdBy: userA })
    .returning();
  if (!room) throw new Error('Failed to create DM');
  await db.insert(chatMembers).values([
    { roomId: room.id, userId: userA, role: 'member', lastReadAt: new Date() },
    { roomId: room.id, userId: userB, role: 'member' },
  ]);
  return room;
}

/** Create a user group with the creator as owner plus the given members. */
export async function createUserGroup(input: {
  creatorId: string;
  organizationId?: string | null;
  title: string;
  description?: string | null;
  avatarUrl?: string | null;
  memberIds: string[];
}): Promise<ChatRoom> {
  const [room] = await db
    .insert(chatRooms)
    .values({
      type: 'group',
      organizationId: input.organizationId ?? null,
      title: input.title,
      description: input.description ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdBy: input.creatorId,
    })
    .returning();
  if (!room) throw new Error('Failed to create group');

  const memberRows = [
    { roomId: room.id, userId: input.creatorId, role: 'owner' as const, lastReadAt: new Date() },
    ...input.memberIds
      .filter((uid) => uid !== input.creatorId)
      .map((uid) => ({ roomId: room.id, userId: uid, role: 'member' as const })),
  ];
  await db.insert(chatMembers).values(memberRows);
  await db.insert(chatMessages).values({ roomId: room.id, senderId: input.creatorId, body: 'Guruh yaratildi', isSystem: true });
  return room;
}

/** Platform-admin monitoring: every room across all mahallas, with org name. */
export async function listAllRooms(): Promise<(RoomSummary & { organizationName: string | null })[]> {
  const rooms = await db
    .select({
      id: chatRooms.id,
      organizationId: chatRooms.organizationId,
      title: chatRooms.title,
      description: chatRooms.description,
      avatarUrl: chatRooms.avatarUrl,
      createdBy: chatRooms.createdBy,
      isActive: chatRooms.isActive,
      isLocked: chatRooms.isLocked,
      createdAt: chatRooms.createdAt,
      updatedAt: chatRooms.updatedAt,
      organizationName: organizations.name,
    })
    .from(chatRooms)
    .leftJoin(organizations, eq(organizations.id, chatRooms.organizationId))
    .orderBy(desc(chatRooms.updatedAt));

  const enriched = await enrichRooms(rooms as unknown as ChatRoom[]);
  return enriched.map((r, i) => ({ ...r, organizationName: rooms[i]?.organizationName ?? null }));
}

async function enrichRooms(rooms: ChatRoom[], userId?: string): Promise<RoomSummary[]> {
  if (rooms.length === 0) return [];
  const ids = rooms.map((r) => r.id);

  // Member counts per room.
  const counts = await db
    .select({ roomId: chatMembers.roomId, c: count() })
    .from(chatMembers)
    .where(and(inArray(chatMembers.roomId, ids), eq(chatMembers.isBanned, false)))
    .groupBy(chatMembers.roomId);
  const countMap = new Map(counts.map((r) => [r.roomId, Number(r.c)]));

  // Last (non-deleted) message per room via a lateral-style fetch.
  const lastByRoom = new Map<string, RoomSummary['lastMessage']>();
  await Promise.all(
    ids.map(async (roomId) => {
      const [m] = await db
        .select({ ...SENDER_COLUMNS, kind: chatMessages.kind, body: chatMessages.body, createdAt: chatMessages.createdAt, isSystem: chatMessages.isSystem })
        .from(chatMessages)
        .leftJoin(users, eq(users.id, chatMessages.senderId))
        .leftJoin(mobileProfiles, eq(mobileProfiles.userId, chatMessages.senderId))
        .where(and(eq(chatMessages.roomId, roomId), eq(chatMessages.isDeleted, false)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);
      if (m) {
        lastByRoom.set(roomId, {
          body: previewText(m.kind, m.body),
          senderName: m.isSystem ? '' : senderDisplay(m).name,
          createdAt: m.createdAt.toISOString(),
          isSystem: m.isSystem,
        });
      }
    }),
  );

  // Membership + unread for the requesting user.
  const membershipMap = new Map<string, ChatMember>();
  if (userId) {
    const memberships = await db
      .select()
      .from(chatMembers)
      .where(and(inArray(chatMembers.roomId, ids), eq(chatMembers.userId, userId)));
    for (const m of memberships) membershipMap.set(m.roomId, m);
  }

  return Promise.all(
    rooms.map(async (room) => {
      const membership = userId ? membershipMap.get(room.id) ?? null : undefined;
      let unreadCount: number | undefined;
      if (userId && membership) {
        const [u] = await db
          .select({ c: count() })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.roomId, room.id),
              eq(chatMessages.isDeleted, false),
              membership.lastReadAt ? gt(chatMessages.createdAt, membership.lastReadAt) : undefined,
            ),
          );
        unreadCount = Number(u?.c ?? 0);
      }

      // DMs show the OTHER participant's name/avatar instead of a group title.
      let title = room.title;
      let avatarUrl = room.avatarUrl;
      let peerUserId: string | null | undefined;
      if (room.type === 'dm' && userId) {
        const [peer] = await db
          .select({ uid: chatMembers.userId, ...SENDER_COLUMNS })
          .from(chatMembers)
          .leftJoin(users, eq(users.id, chatMembers.userId))
          .leftJoin(mobileProfiles, eq(mobileProfiles.userId, chatMembers.userId))
          .where(and(eq(chatMembers.roomId, room.id), ne(chatMembers.userId, userId)))
          .limit(1);
        if (peer) {
          const d = senderDisplay(peer);
          title = d.name;
          avatarUrl = d.avatar;
          peerUserId = peer.uid;
        }
      }

      return {
        ...room,
        title,
        avatarUrl,
        peerUserId,
        memberCount: countMap.get(room.id) ?? 0,
        lastMessage: lastByRoom.get(room.id) ?? null,
        membership: membership
          ? { role: membership.role, isMuted: membership.isMuted, isBanned: membership.isBanned }
          : membership === null ? null : undefined,
        unreadCount,
      };
    }),
  );
}

export async function createRoom(input: {
  organizationId: string;
  title: string;
  description?: string | null;
  avatarUrl?: string | null;
  createdBy: string;
}): Promise<ChatRoom> {
  const [room] = await db
    .insert(chatRooms)
    .values({
      organizationId: input.organizationId,
      title: input.title,
      description: input.description ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdBy: input.createdBy,
    })
    .returning();
  if (!room) throw new Error('Failed to create chat room');

  // Creator becomes the owner member.
  await db.insert(chatMembers).values({ roomId: room.id, userId: input.createdBy, role: 'owner' });
  await db.insert(chatMessages).values({
    roomId: room.id,
    senderId: input.createdBy,
    body: 'Guruh yaratildi',
    isSystem: true,
  });
  return room;
}

export async function updateRoom(roomId: string, patch: Partial<ChatRoom>): Promise<ChatRoom | null> {
  const [row] = await db
    .update(chatRooms)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(chatRooms.id, roomId))
    .returning();
  return row ?? null;
}

/** Delete a room (members + messages cascade via FK). */
export async function deleteRoom(roomId: string): Promise<void> {
  await db.delete(chatRooms).where(eq(chatRooms.id, roomId));
}

// ─── Membership ───────────────────────────────────────────────────────────────

export async function getMembership(roomId: string, userId: string): Promise<ChatMember | null> {
  const [m] = await db
    .select()
    .from(chatMembers)
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)));
  return m ?? null;
}

/** Join a room (idempotent). Returns the membership row. */
export async function joinRoom(roomId: string, userId: string, role: ChatMember['role'] = 'member'): Promise<ChatMember> {
  const existing = await getMembership(roomId, userId);
  if (existing) {
    if (existing.isBanned) throw new Error('BANNED');
    return existing;
  }
  const [m] = await db
    .insert(chatMembers)
    .values({ roomId, userId, role, lastReadAt: new Date() })
    .returning();
  return m!;
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  await db.delete(chatMembers).where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)));
}

export async function listMembers(roomId: string) {
  const rows = await db
    .select({
      userId: chatMembers.userId,
      username: users.username,
      role: chatMembers.role,
      isMuted: chatMembers.isMuted,
      isBanned: chatMembers.isBanned,
      joinedAt: chatMembers.joinedAt,
      ...SENDER_COLUMNS,
    })
    .from(chatMembers)
    .leftJoin(users, eq(users.id, chatMembers.userId))
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, chatMembers.userId))
    .where(eq(chatMembers.roomId, roomId))
    .orderBy(desc(chatMembers.role));
  return rows.map((r) => {
    const d = senderDisplay(r);
    return {
      userId: r.userId,
      username: r.username,
      name: d.name,
      avatar: d.avatar,
      role: r.role,
      isMuted: r.isMuted,
      isBanned: r.isBanned,
      joinedAt: r.joinedAt.toISOString(),
    };
  });
}

export async function setMemberFlags(
  roomId: string,
  userId: string,
  flags: { isMuted?: boolean; isBanned?: boolean; role?: ChatMember['role'] },
): Promise<void> {
  await db
    .update(chatMembers)
    .set(flags)
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)));
}

export async function markRead(roomId: string, userId: string): Promise<void> {
  await db
    .update(chatMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

// Reusable message column projection (joined sender columns added per query).
const MESSAGE_COLUMNS = {
  id: chatMessages.id,
  roomId: chatMessages.roomId,
  senderId: chatMessages.senderId,
  kind: chatMessages.kind,
  body: chatMessages.body,
  fileUrl: chatMessages.fileUrl,
  fileName: chatMessages.fileName,
  fileSize: chatMessages.fileSize,
  mimeType: chatMessages.mimeType,
  durationSec: chatMessages.durationSec,
  replyToId: chatMessages.replyToId,
  isDeleted: chatMessages.isDeleted,
  isSystem: chatMessages.isSystem,
  editedAt: chatMessages.editedAt,
  createdAt: chatMessages.createdAt,
};

function mapMessageRow(r: any): EnrichedMessage {
  const d = r.isSystem ? { name: '', avatar: null } : senderDisplay(r);
  return {
    id: r.id,
    roomId: r.roomId,
    senderId: r.senderId,
    senderName: d.name,
    senderAvatar: d.avatar,
    kind: (r.kind ?? 'text') as MessageKind,
    body: r.isDeleted ? '' : r.body,
    fileUrl: r.isDeleted ? null : r.fileUrl ?? null,
    fileName: r.isDeleted ? null : r.fileName ?? null,
    fileSize: r.isDeleted ? null : r.fileSize ?? null,
    mimeType: r.isDeleted ? null : r.mimeType ?? null,
    durationSec: r.isDeleted ? null : r.durationSec ?? null,
    replyToId: r.replyToId,
    isSystem: r.isSystem,
    isDeleted: r.isDeleted,
    editedAt: r.editedAt ? r.editedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listMessages(
  roomId: string,
  opts: { limit: number; before?: string },
): Promise<EnrichedMessage[]> {
  const rows = await db
    .select({ ...MESSAGE_COLUMNS, ...SENDER_COLUMNS })
    .from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.senderId))
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, chatMessages.senderId))
    .where(
      and(
        eq(chatMessages.roomId, roomId),
        opts.before ? lt(chatMessages.createdAt, new Date(opts.before)) : undefined,
      ),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(opts.limit);

  // Return ascending (oldest → newest) for natural chat rendering.
  return rows.reverse().map(mapMessageRow);
}

export async function getMemberUserIds(roomId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: chatMembers.userId })
    .from(chatMembers)
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.isBanned, false)));
  return rows.map((r) => r.userId);
}

async function enrichById(messageId: string): Promise<EnrichedMessage> {
  const [row] = await db
    .select({ ...MESSAGE_COLUMNS, ...SENDER_COLUMNS })
    .from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.senderId))
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, chatMessages.senderId))
    .where(eq(chatMessages.id, messageId));
  return mapMessageRow(row);
}

export async function getMessageById(roomId: string, messageId: string) {
  const [row] = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.roomId, roomId)));
  return row ?? null;
}

/** Insert a message (text or attachment), bump the room, broadcast, return enriched. */
export async function createMessage(input: {
  roomId: string;
  senderId: string | null;
  kind?: MessageKind;
  body?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  durationSec?: number | null;
  replyToId?: string | null;
  isSystem?: boolean;
}): Promise<EnrichedMessage> {
  const [inserted] = await db
    .insert(chatMessages)
    .values({
      roomId: input.roomId,
      senderId: input.senderId,
      kind: input.kind ?? 'text',
      body: input.body ?? '',
      fileUrl: input.fileUrl ?? null,
      fileName: input.fileName ?? null,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      durationSec: input.durationSec ?? null,
      replyToId: input.replyToId ?? null,
      isSystem: input.isSystem ?? false,
    })
    .returning();
  if (!inserted) throw new Error('Failed to insert chat message');

  await db.update(chatRooms).set({ updatedAt: new Date() }).where(eq(chatRooms.id, input.roomId));

  const enriched = await enrichById(inserted.id);
  const memberIds = await getMemberUserIds(input.roomId);
  wsBroadcast(memberIds, { type: 'chat_message', payload: enriched });
  return enriched;
}

/** Edit a text message's body (sender only — caller enforces ownership). */
export async function editMessage(roomId: string, messageId: string, body: string): Promise<EnrichedMessage | null> {
  const [row] = await db
    .update(chatMessages)
    .set({ body, editedAt: new Date() })
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.roomId, roomId)))
    .returning();
  if (!row) return null;
  const enriched = await enrichById(messageId);
  const memberIds = await getMemberUserIds(roomId);
  wsBroadcast(memberIds, { type: 'chat_message_edited', payload: enriched });
  return enriched;
}

export async function deleteMessage(roomId: string, messageId: string): Promise<EnrichedMessage | null> {
  const [row] = await db
    .update(chatMessages)
    .set({ isDeleted: true })
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.roomId, roomId)))
    .returning();
  if (!row) return null;

  const payload = mapMessageRow({ ...row, uFirst: null, uLast: null, uAvatar: null, mpFirst: null, mpLast: null, mpAvatar: null });
  const memberIds = await getMemberUserIds(roomId);
  wsBroadcast(memberIds, { type: 'chat_message_deleted', payload: { id: row.id, roomId } });
  return payload;
}

/** Ensure a web admin / moderator has a member row so they can post and be listed. */
export async function ensureAdminMembership(roomId: string, userId: string): Promise<ChatMember> {
  const existing = await getMembership(roomId, userId);
  if (existing) {
    if (existing.role === 'member') {
      await setMemberFlags(roomId, userId, { role: 'admin' });
      return { ...existing, role: 'admin' };
    }
    return existing;
  }
  const [m] = await db
    .insert(chatMembers)
    .values({ roomId, userId, role: 'admin', lastReadAt: new Date() })
    .returning();
  return m!;
}
