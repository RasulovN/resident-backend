import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import path from 'node:path';
import { corsOrigins, env } from './config/env';
import { registerErrorHandler } from './common/middleware/error-handler';
import { authRoutes } from './features/auth/auth.routes';
import { entityRoutes } from './features/entities/entities.routes';
import { memberRoutes } from './features/members/members.routes';
import { menuRoutes } from './features/menus/menus.routes';
import {
  adminOrganizationRoutes,
  organizationRoutes,
} from './features/organizations/organizations.routes';
import { permissionRoutes } from './features/permissions/permissions.routes';
import { roleRoutes } from './features/roles/roles.routes';
import { adminPlanRoutes, planRoutes } from './features/subscriptions/subscriptions.routes';
import { adminUserRoutes } from './features/users/users.routes';
import { uploadRoutes } from './features/uploads/uploads.routes';
import { residentRoutes } from './features/residents/residents.routes';
import { buildingRoutes } from './features/buildings/buildings.routes';
import { householdRoutes } from './features/households/households.routes';
import { billingRoutes } from './features/billing/billing.routes';
import { serviceRoutes } from './features/services/services.routes';
import { mobileServiceRoutes } from './features/services/mobile-services.routes';
import { geoRoutes } from './features/geo/geo.routes';
import { adminRoutes } from './features/admin/admin.routes';
import { announcementRoutes } from './features/announcements/announcements.routes';
import { settingsRoutes } from './features/settings/settings.routes';
import { territoriesRoutes } from './features/territories/territories.routes';
import { businessRoutes } from './features/businesses/businesses.routes';
import { mobileAuthRoutes } from './features/mobile/mobile-auth.routes';
import {
  adminNotificationRoutes,
  notificationRoutes,
  tenantNotificationRoutes,
} from './features/notifications/notifications.routes';
import { mobileBusinessRoutes } from './features/mobile/mobile-businesses.routes';
import { mobileMahallaRoutes } from './features/mobile/mobile-mahalla.routes';
import { mobileResidentRoutes } from './features/mobile/mobile-resident.routes';
import { adminChatRoutes, chatRoutes, mobileChatRoutes } from './features/chat/chat.routes';
import { adminRbacRoutes } from './features/roles/admin-rbac.routes';
import { mobileUserRoutes } from './features/mobile/mobile-users.routes';
import { inquiryRoutes } from './features/inquiries/inquiries.routes';
import { mobileInquiryRoutes } from './features/inquiries/mobile-inquiries.routes';
import { auditRoutes, mobileActivityRoutes } from './features/audit/audit.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
          : undefined,
    },
  });

  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await app.register(websocket);

  // Serve uploaded files as static assets
  await app.register(staticPlugin, {
    root: path.resolve(env.UPLOAD_DIR),
    prefix: '/uploads/',
    decorateReply: false,
  });

  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  // Feature routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(organizationRoutes, { prefix: '/api/organizations' });
  await app.register(memberRoutes, { prefix: '/api/members' });
  await app.register(roleRoutes, { prefix: '/api/roles' });
  await app.register(permissionRoutes, { prefix: '/api/permissions' });
  await app.register(menuRoutes, { prefix: '/api/menus' });
  await app.register(entityRoutes, { prefix: '/api/entities' });
  await app.register(planRoutes, { prefix: '/api/plans' });
  await app.register(uploadRoutes, { prefix: '/api/uploads' });

  // Mahalla OS domain routes
  await app.register(residentRoutes, { prefix: '/api/residents' });
  await app.register(buildingRoutes, { prefix: '/api/buildings' });
  await app.register(householdRoutes, { prefix: '/api/households' });
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(serviceRoutes, { prefix: '/api/services' });
  await app.register(mobileServiceRoutes, { prefix: '/api/mobile/services' });
  await app.register(mobileAuthRoutes, { prefix: '/api/mobile/auth' });
  await app.register(mobileBusinessRoutes, { prefix: '/api/mobile/businesses' });
  await app.register(mobileMahallaRoutes, { prefix: '/api/mobile/mahalla' });
  await app.register(mobileResidentRoutes, { prefix: '/api/mobile/residents' });
  await app.register(mobileChatRoutes, { prefix: '/api/mobile/chat' });
  await app.register(mobileUserRoutes, { prefix: '/api/mobile/users' });
  await app.register(geoRoutes, { prefix: '/api/geo' });
  await app.register(territoriesRoutes, { prefix: '/api/territories' });
  await app.register(businessRoutes, { prefix: '/api/businesses' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(inquiryRoutes, { prefix: '/api/inquiries' });
  await app.register(mobileInquiryRoutes, { prefix: '/api/mobile/inquiries' });
  await app.register(auditRoutes, { prefix: '/api/audit-logs' });
  await app.register(mobileActivityRoutes, { prefix: '/api/mobile/activity' });

  // Platform-admin routes
  await app.register(adminOrganizationRoutes, { prefix: '/api/admin/organizations' });
  await app.register(adminUserRoutes, { prefix: '/api/admin/users' });
  await app.register(adminPlanRoutes, { prefix: '/api/admin/plans' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(adminRbacRoutes, { prefix: '/api/admin' });
  await app.register(adminChatRoutes, { prefix: '/api/admin/chat' });
  await app.register(announcementRoutes, { prefix: '/api/admin/announcements' });
  await app.register(settingsRoutes, { prefix: '/api/admin/settings' });

  // Notification system
  await app.register(notificationRoutes,       { prefix: '/api/notifications' });
  await app.register(tenantNotificationRoutes, { prefix: '/api/notifications' });
  await app.register(adminNotificationRoutes,  { prefix: '/api/admin/notifications' });

  return app;
}
