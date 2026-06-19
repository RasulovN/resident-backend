import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '../../common/utils/response';
import { mobileAuthGuard } from '../../common/middleware/mobile-auth';
import * as chat from '../chat/chat.service';
import { isUsernameAvailable } from './mobile-auth.service';

/** Mobile user directory — used to start DMs and add group members. */
export async function mobileUserRoutes(app: FastifyInstance) {
  // GET /api/mobile/users/search?q=
  app.get('/search', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { q } = z.object({ q: z.string().min(1).max(80) }).parse(req.query);
    const users = await chat.searchUsers(q, req.authUser!.id);
    return reply.send(ok(users));
  });

  // GET /api/mobile/users/username-available?username=
  app.get('/username-available', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { username } = z.object({ username: z.string().min(3).max(32) }).parse(req.query);
    const available = await isUsernameAvailable(username, req.authUser!.id);
    return reply.send(ok({ available }));
  });

  // GET /api/mobile/users/:id — view a user's public profile (phone/email per privacy)
  app.get('/:id', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const profile = await chat.getPublicProfile(id, req.authUser!.id);
    if (!profile) return reply.status(404).send({ status: 'error', message: 'Foydalanuvchi topilmadi' });
    return reply.send(ok(profile));
  });

  // ── Contacts ──────────────────────────────────────────────────────────────
  // GET /api/mobile/users/contacts
  app.get('/contacts', { preHandler: mobileAuthGuard }, async (req, reply) => {
    return reply.send(ok(await chat.listContacts(req.authUser!.id)));
  });

  // POST /api/mobile/users/contacts { userId }
  app.post('/contacts', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
    await chat.addContact(req.authUser!.id, userId);
    return reply.status(201).send(ok({ added: true }));
  });

  // DELETE /api/mobile/users/contacts/:userId
  app.delete('/contacts/:userId', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params);
    await chat.removeContact(req.authUser!.id, userId);
    return reply.send(ok({ removed: true }));
  });
}
