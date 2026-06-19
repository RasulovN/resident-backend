import type { FastifyInstance } from 'fastify';
import { mobileAuthGuard } from '../../common/middleware/mobile-auth';
import { ok } from '../../common/utils/response';
import * as service from './mobile-auth.service';
import { sendOtpSchema, verifyOtpSchema, updateProfileSchema } from './mobile-auth.schema';

export async function mobileAuthRoutes(app: FastifyInstance) {
  const authLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

  // POST /api/mobile/auth/send-otp
  app.post('/send-otp', authLimit, async (req, reply) => {
    const { phone } = sendOtpSchema.parse(req.body);
    const result = await service.sendOtp(phone);
    return reply.send(ok(result));
  });

  // POST /api/mobile/auth/verify-otp
  app.post('/verify-otp', authLimit, async (req, reply) => {
    const { phone, code, device } = verifyOtpSchema.parse(req.body);
    const ctx = { userAgent: req.headers['user-agent'], ip: req.ip, device };
    const result = await service.verifyOtp(phone, code, ctx);
    return reply.status(200).send(ok(result));
  });

  // POST /api/mobile/auth/refresh
  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) throw new Error('refreshToken required');
    const ctx = { userAgent: req.headers['user-agent'], ip: req.ip };
    const result = await service.mobileRefresh(refreshToken, ctx);
    return reply.send(ok(result));
  });

  // GET /api/mobile/auth/me
  app.get('/me', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const profile = await service.getProfile(req.authUser!.id);
    return reply.send(ok(profile));
  });

  // PATCH /api/mobile/auth/profile
  app.patch('/profile', { preHandler: mobileAuthGuard }, async (req, reply) => {
    const data = updateProfileSchema.parse(req.body);
    const updated = await service.updateProfile(req.authUser!.id, data);
    return reply.send(ok(updated));
  });
}
