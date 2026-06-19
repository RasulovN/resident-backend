import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '../../common/utils/response';
import { AppError } from '../../common/errors/app-error';
import { verifyAccessToken } from '../../common/utils/tokens';
import { wsAdd, wsRemove } from '../../common/ws/ws-manager';
import { mobileAuthGuard, mobileTenantContext } from '../../common/middleware/mobile-auth';
import { tenantContext } from '../../common/middleware/tenant';
import { platformAdminGuard } from '../../common/middleware/auth';
import { createRoomSchema, editMessageSchema, listMessagesQuery, sendMessageSchema, updateRoomSchema } from './chat.schema';
import * as chat from './chat.service';

const idParam = z.object({ id: z.string().uuid() });
const ACCESS_COOKIE = 'access_token';

// ════════════════════════════════════════════════════════════════════════════
// MOBILE — residents (Bearer token + X-Mahalla-Id)
// ════════════════════════════════════════════════════════════════════════════
export async function mobileChatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', mobileTenantContext);

  // Realtime stream. Authenticates via ?token= because RN WebSocket cannot set headers.
  app.get('/ws', { websocket: true }, async (socket, request) => {
    const queryToken = (request.query as Record<string, string>).token;
    const bearer = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookieToken = request.cookies?.[ACCESS_COOKIE];
    const token = queryToken ?? bearer ?? cookieToken;
    if (!token) { socket.close(1008, 'Unauthorized'); return; }
    try {
      const payload = await verifyAccessToken(token);
      const userId = payload.sub;
      wsAdd(userId, socket);
      socket.on('close', () => wsRemove(userId, socket));
      socket.on('error', () => wsRemove(userId, socket));
      const ping = setInterval(() => { if (socket.readyState === 1) socket.ping(); }, 30_000);
      socket.on('close', () => clearInterval(ping));
    } catch {
      socket.close(1008, 'Unauthorized');
    }
  });

  // Unified chat list: DMs, groups, joined + discoverable mahalla rooms.
  app.get('/rooms', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const rooms = await chat.listRoomsForUser(req.authUser!.id, req.organizationId ?? null);
    return reply.send(ok(rooms));
  });

  // Create a user group.
  app.post('/rooms', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const body = z.object({
      title: z.string().min(1).max(120),
      description: z.string().max(500).optional().nullable(),
      avatarUrl: z.string().url().optional().nullable(),
      memberIds: z.array(z.string().uuid()).default([]),
    }).parse(req.body);
    const room = await chat.createUserGroup({
      creatorId: req.authUser!.id,
      organizationId: req.organizationId ?? null,
      title: body.title,
      description: body.description,
      avatarUrl: body.avatarUrl,
      memberIds: body.memberIds,
    });
    return reply.status(201).send(ok(await chat.getRoomForUser(room.id, req.authUser!.id) ?? room));
  });

  // Open (or reuse) a 1-to-1 DM.
  app.post('/dm', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
    if (userId === req.authUser!.id) throw AppError.badRequest("O'zingiz bilan suhbat ochib bo'lmaydi");
    const room = await chat.findOrCreateDm(req.authUser!.id, userId);
    return reply.status(201).send(ok(await chat.getRoomForUser(room.id, req.authUser!.id) ?? room));
  });

  // Room detail + my membership (DM peer resolved server-side).
  app.get('/rooms/:id', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const room = await chat.getRoom(id);
    if (!room) throw AppError.notFound('Chat topilmadi');
    const membership = await chat.getMembership(id, req.authUser!.id);
    const isMahallaInOrg = room.type === 'mahalla' && room.organizationId === req.organizationId;
    if (!membership && !isMahallaInOrg) throw AppError.forbidden('Ruxsat yo\'q');
    const summary = await chat.getRoomForUser(id, req.authUser!.id);
    return reply.send(ok(summary ?? { ...room, membership }));
  });

  // Join — only the discoverable mahalla community chat is open-join.
  app.post('/rooms/:id/join', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const room = await chat.getRoom(id);
    if (!room || !room.isActive) throw AppError.notFound('Chat topilmadi');
    if (room.type !== 'mahalla' || room.organizationId !== req.organizationId) {
      throw AppError.forbidden("Bu chatga qo'shilib bo'lmaydi");
    }
    try {
      const membership = await chat.joinRoom(id, req.authUser!.id);
      return reply.send(ok({ joined: true, membership }));
    } catch (e) {
      if ((e as Error).message === 'BANNED') throw AppError.forbidden('Siz bu chatdan chetlatilgansiz');
      throw e;
    }
  });

  app.post('/rooms/:id/leave', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await chat.leaveRoom(id, req.authUser!.id);
    return reply.send(ok({ left: true }));
  });

  // Message history (members only).
  app.get('/rooms/:id/messages', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const q = listMessagesQuery.parse(req.query);
    const room = await chat.getRoom(id);
    if (!room) throw AppError.notFound('Chat topilmadi');
    const membership = await chat.getMembership(id, req.authUser!.id);
    if (!membership) throw AppError.forbidden('Avval chatga qo\'shiling');
    const messages = await chat.listMessages(id, q);
    return reply.send(ok(messages));
  });

  // Send a message (members only; muted/locked rules apply).
  app.post('/rooms/:id/messages', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = sendMessageSchema.parse(req.body);
    const room = await chat.getRoom(id);
    if (!room) throw AppError.notFound('Chat topilmadi');
    const membership = await chat.getMembership(id, req.authUser!.id);
    if (!membership) throw AppError.forbidden('Avval chatga qo\'shiling');
    if (membership.isBanned) throw AppError.forbidden('Siz chetlatilgansiz');
    const isModerator = membership.role === 'owner' || membership.role === 'admin';
    if (membership.isMuted && !isModerator) throw AppError.forbidden('Siz ovozsiz qilingansiz');
    if (room.isLocked && !isModerator) throw AppError.forbidden('Faqat adminlar yoza oladi');
    const message = await chat.createMessage({
      roomId: id,
      senderId: req.authUser!.id,
      kind: body.kind,
      body: body.body,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      durationSec: body.durationSec,
      replyToId: body.replyToId,
    });
    await chat.markRead(id, req.authUser!.id);
    return reply.status(201).send(ok(message));
  });

  // Edit own message (text only).
  app.patch('/rooms/:id/messages/:msgId', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id, msgId } = z.object({ id: z.string().uuid(), msgId: z.string().uuid() }).parse(req.params);
    const { body } = editMessageSchema.parse(req.body);
    const msg = await chat.getMessageById(id, msgId);
    if (!msg) throw AppError.notFound('Xabar topilmadi');
    if (msg.senderId !== req.authUser!.id) throw AppError.forbidden('Faqat o\'z xabaringizni tahrirlay olasiz');
    if (msg.kind !== 'text') throw AppError.badRequest('Faqat matnli xabarni tahrirlash mumkin');
    const updated = await chat.editMessage(id, msgId, body);
    return reply.send(ok(updated));
  });

  // Delete own message (moderators may delete any).
  app.delete('/rooms/:id/messages/:msgId', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id, msgId } = z.object({ id: z.string().uuid(), msgId: z.string().uuid() }).parse(req.params);
    const msg = await chat.getMessageById(id, msgId);
    if (!msg) throw AppError.notFound('Xabar topilmadi');
    const membership = await chat.getMembership(id, req.authUser!.id);
    const isModerator = membership?.role === 'owner' || membership?.role === 'admin';
    if (msg.senderId !== req.authUser!.id && !isModerator) throw AppError.forbidden('Ruxsat yo\'q');
    await chat.deleteMessage(id, msgId);
    return reply.send(ok({ deleted: true }));
  });

  app.post('/rooms/:id/read', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await chat.markRead(id, req.authUser!.id);
    return reply.send(ok({ read: true }));
  });

  app.get('/rooms/:id/members', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    // Gate by membership (DM/group rooms are org-less → org check would wrongly 404).
    const membership = await chat.getMembership(id, req.authUser!.id);
    if (!membership) throw AppError.forbidden('Ruxsat yo\'q');
    const members = await chat.listMembers(id);
    return reply.send(ok(members));
  });

  // Edit a group (owner/admin only; the mahalla room is not user-editable).
  app.patch('/rooms/:id', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const patch = updateRoomSchema.parse(req.body);
    const room = await chat.getRoom(id);
    if (!room) throw AppError.notFound('Chat topilmadi');
    const membership = await chat.getMembership(id, req.authUser!.id);
    const canEdit = membership?.role === 'owner' || membership?.role === 'admin';
    if (room.type === 'mahalla' || !canEdit) throw AppError.forbidden('Ruxsat yo\'q');
    const updated = await chat.updateRoom(id, patch);
    return reply.send(ok(updated));
  });

  // Delete a group — only its owner (creator); never the mahalla room.
  app.delete('/rooms/:id', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const room = await chat.getRoom(id);
    if (!room) throw AppError.notFound('Chat topilmadi');
    const membership = await chat.getMembership(id, req.authUser!.id);
    if (room.type === 'mahalla' || membership?.role !== 'owner') {
      throw AppError.forbidden('Faqat guruh egasi o\'chira oladi');
    }
    await chat.deleteRoom(id);
    return reply.send(ok({ deleted: true }));
  });

  // Add members to a group (owner/admin only; not the mahalla room).
  app.post('/rooms/:id/members', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { userIds } = z.object({ userIds: z.array(z.string().uuid()).min(1).max(50) }).parse(req.body);
    const room = await chat.getRoom(id);
    if (!room) throw AppError.notFound('Chat topilmadi');
    const membership = await chat.getMembership(id, req.authUser!.id);
    const canManage = membership?.role === 'owner' || membership?.role === 'admin';
    if (room.type === 'mahalla' || !canManage) throw AppError.forbidden('Ruxsat yo\'q');
    for (const uid of userIds) {
      try { await chat.joinRoom(id, uid, 'member'); } catch { /* banned/dup — skip */ }
    }
    const members = await chat.listMembers(id);
    return reply.send(ok(members));
  });

  // Remove a member (owner/admin; the group owner cannot be removed).
  app.delete('/rooms/:id/members/:userId', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id, userId } = z.object({ id: z.string().uuid(), userId: z.string().uuid() }).parse(req.params);
    const room = await chat.getRoom(id);
    if (!room) throw AppError.notFound('Chat topilmadi');
    const membership = await chat.getMembership(id, req.authUser!.id);
    const canManage = membership?.role === 'owner' || membership?.role === 'admin';
    if (room.type === 'mahalla' || !canManage) throw AppError.forbidden('Ruxsat yo\'q');
    if (userId === room.createdBy) throw AppError.forbidden('Guruh egasini chiqarib bo\'lmaydi');
    await chat.leaveRoom(id, userId);
    const members = await chat.listMembers(id);
    return reply.send(ok(members));
  });
}

// ════════════════════════════════════════════════════════════════════════════
// WEB — mahalla admin. Gated by org membership (tenantContext): any member of the
// mahalla may read/post/moderate its chat; platform admins bypass automatically.
// ════════════════════════════════════════════════════════════════════════════
export async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', tenantContext);

  app.get('/rooms', async (req, reply) => {
    const rooms = await chat.listRoomsForOrg(req.organizationId!, req.authUser!.id);
    return reply.send(ok(rooms));
  });

  app.post('/rooms', async (req, reply) => {
    const body = createRoomSchema.parse(req.body);
    const room = await chat.createRoom({
      organizationId: req.organizationId!,
      title: body.title,
      description: body.description,
      avatarUrl: body.avatarUrl,
      createdBy: req.authUser!.id,
    });
    return reply.status(201).send(ok(room));
  });

  app.patch('/rooms/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const patch = updateRoomSchema.parse(req.body);
    const room = await chat.getRoom(id);
    if (!room || room.organizationId !== req.organizationId) throw AppError.notFound('Chat topilmadi');
    const updated = await chat.updateRoom(id, patch);
    return reply.send(ok(updated));
  });

  app.get('/rooms/:id/messages', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const q = listMessagesQuery.parse(req.query);
    const room = await chat.getRoom(id);
    if (!room || room.organizationId !== req.organizationId) throw AppError.notFound('Chat topilmadi');
    const messages = await chat.listMessages(id, q);
    return reply.send(ok(messages));
  });

  // Mahalla admin posts into the room.
  app.post('/rooms/:id/messages', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = sendMessageSchema.parse(req.body);
    const room = await chat.getRoom(id);
    if (!room || room.organizationId !== req.organizationId) throw AppError.notFound('Chat topilmadi');
    await chat.ensureAdminMembership(id, req.authUser!.id);
    const message = await chat.createMessage({
      roomId: id,
      senderId: req.authUser!.id,
      kind: body.kind,
      body: body.body,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      durationSec: body.durationSec,
      replyToId: body.replyToId,
    });
    return reply.status(201).send(ok(message));
  });

  // Edit own message (text only).
  app.patch('/rooms/:id/messages/:msgId', async (req, reply) => {
    const { id, msgId } = z.object({ id: z.string().uuid(), msgId: z.string().uuid() }).parse(req.params);
    const { body } = editMessageSchema.parse(req.body);
    const room = await chat.getRoom(id);
    if (!room || room.organizationId !== req.organizationId) throw AppError.notFound('Chat topilmadi');
    const msg = await chat.getMessageById(id, msgId);
    if (!msg) throw AppError.notFound('Xabar topilmadi');
    if (msg.senderId !== req.authUser!.id) throw AppError.forbidden('Faqat o\'z xabaringizni tahrirlay olasiz');
    if (msg.kind !== 'text') throw AppError.badRequest('Faqat matnli xabarni tahrirlash mumkin');
    return reply.send(ok(await chat.editMessage(id, msgId, body)));
  });

  app.delete('/rooms/:id/messages/:msgId', async (req, reply) => {
    const { id, msgId } = z.object({ id: z.string().uuid(), msgId: z.string().uuid() }).parse(req.params);
    const room = await chat.getRoom(id);
    if (!room || room.organizationId !== req.organizationId) throw AppError.notFound('Chat topilmadi');
    const deleted = await chat.deleteMessage(id, msgId);
    if (!deleted) throw AppError.notFound('Xabar topilmadi');
    return reply.send(ok({ deleted: true }));
  });

  app.get('/rooms/:id/members', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const room = await chat.getRoom(id);
    if (!room || room.organizationId !== req.organizationId) throw AppError.notFound('Chat topilmadi');
    return reply.send(ok(await chat.listMembers(id)));
  });

  // Moderate a member: mute / ban / promote.
  app.patch('/rooms/:id/members/:userId', async (req, reply) => {
    const { id, userId } = z.object({ id: z.string().uuid(), userId: z.string().uuid() }).parse(req.params);
    const flags = z.object({
      isMuted: z.boolean().optional(),
      isBanned: z.boolean().optional(),
      role: z.enum(['owner', 'admin', 'member']).optional(),
    }).parse(req.body);
    await chat.setMemberFlags(id, userId, flags);
    return reply.send(ok({ updated: true }));
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PLATFORM ADMIN — super-admin monitoring across all mahallas
// ════════════════════════════════════════════════════════════════════════════
export async function adminChatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', platformAdminGuard);

  app.get('/rooms', async (_req, reply) => {
    return reply.send(ok(await chat.listAllRooms()));
  });

  app.get('/rooms/:id/messages', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const q = listMessagesQuery.parse(req.query);
    const room = await chat.getRoom(id);
    if (!room) throw AppError.notFound('Chat topilmadi');
    return reply.send(ok(await chat.listMessages(id, q)));
  });

  app.get('/rooms/:id/members', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    return reply.send(ok(await chat.listMembers(id)));
  });

  app.delete('/rooms/:id/messages/:msgId', async (req, reply) => {
    const { id, msgId } = z.object({ id: z.string().uuid(), msgId: z.string().uuid() }).parse(req.params);
    const deleted = await chat.deleteMessage(id, msgId);
    if (!deleted) throw AppError.notFound('Xabar topilmadi');
    return reply.send(ok({ deleted: true }));
  });

  app.patch('/rooms/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const patch = updateRoomSchema.parse(req.body);
    const updated = await chat.updateRoom(id, patch);
    if (!updated) throw AppError.notFound('Chat topilmadi');
    return reply.send(ok(updated));
  });
}
