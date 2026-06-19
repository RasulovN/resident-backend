import type { FastifyInstance } from 'fastify';
import { authGuard, platformAdminGuard } from '../../common/middleware/auth';
import { tenantContext } from '../../common/middleware/tenant';
import { ACCESS_COOKIE } from '../../common/utils/cookies';
import { verifyAccessToken } from '../../common/utils/tokens';
import { wsAdd, wsRemove } from '../../common/ws/ws-manager';
import * as c from './notifications.controller';

export async function notificationRoutes(app: FastifyInstance) {
  // ── WebSocket: real-time notification push ─────────────────────────────────
  app.get('/ws', { websocket: true }, async (socket, request) => {
    const cookieToken = request.cookies?.[ACCESS_COOKIE];
    const queryToken  = (request.query as Record<string, string>).token;
    const bearerToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = cookieToken ?? queryToken ?? bearerToken;
    if (!token) { socket.close(1008, 'Unauthorized'); return; }
    try {
      const payload = await verifyAccessToken(token);
      const userId = payload.sub;
      wsAdd(userId, socket);
      socket.on('close', () => wsRemove(userId, socket));
      socket.on('error', () => wsRemove(userId, socket));
      // Send ping every 30s to keep connection alive
      const ping = setInterval(() => {
        if (socket.readyState === 1) socket.ping();
      }, 30_000);
      socket.on('close', () => clearInterval(ping));
    } catch {
      socket.close(1008, 'Unauthorized');
    }
  });

  // ── User inbox (any authenticated user) ───────────────────────────────────
  app.register(async (inbox) => {
    inbox.addHook('preHandler', authGuard);
    inbox.get('/inbox',              c.inboxHandler);
    inbox.get('/inbox/unread-count', c.unreadCountHandler);
    inbox.patch('/inbox/:id/read',   c.markReadHandler);
    inbox.patch('/inbox/read-all',   c.markAllReadHandler);

    // Device push token registration
    inbox.post('/devices',          c.registerDeviceHandler);
    inbox.delete('/devices/:id',    c.removeDeviceHandler);
  });
}

export async function tenantNotificationRoutes(app: FastifyInstance) {
  // ── Mahalla admin: manage org's notifications ─────────────────────────────
  app.register(async (tenant) => {
    tenant.addHook('preHandler', tenantContext);
    tenant.get('/',                c.listHandler);
    tenant.post('/',               c.createHandler);
    tenant.patch('/:id',           c.updateHandler);
    tenant.post('/:id/send',       c.sendHandler);
    tenant.post('/:id/cancel',     c.cancelHandler);
    tenant.delete('/:id',          c.deleteHandler);
    tenant.get('/analytics',       c.analyticsHandler);

    // Templates
    tenant.get('/templates',       c.listTemplatesHandler);
    tenant.post('/templates',      c.createTemplateHandler);
    tenant.delete('/templates/:id', c.deleteTemplateHandler);
  });
}

export async function adminNotificationRoutes(app: FastifyInstance) {
  // ── Platform admin: manage platform-wide notifications ────────────────────
  app.register(async (admin) => {
    admin.addHook('preHandler', platformAdminGuard);
    admin.get('/',              c.adminListHandler);
    admin.post('/',             c.adminCreateHandler);
    admin.get('/:id',           c.adminGetHandler);
    admin.post('/:id/send',     c.adminSendHandler);
    admin.delete('/:id',        c.adminDeleteHandler);
    admin.get('/analytics',     c.adminAnalyticsHandler);
  });
}
