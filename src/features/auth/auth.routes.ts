import type { FastifyInstance } from 'fastify';
import { authGuard } from '../../common/middleware/auth';
import * as c from './auth.controller';

export async function authRoutes(app: FastifyInstance) {
  // Stricter rate limit on auth endpoints to slow brute force.
  const authLimit = {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  };

  app.post('/register', authLimit, c.registerHandler);
  app.post('/verify-email', c.verifyEmailHandler);
  app.post('/resend-verification', authLimit, c.resendVerificationHandler);
  app.post('/login', authLimit, c.loginHandler);
  app.post('/refresh', c.refreshHandler);
  app.post('/logout', c.logoutHandler);
  app.post('/forgot-password', authLimit, c.forgotPasswordHandler);
  app.post('/reset-password', authLimit, c.resetPasswordHandler);

  app.get('/me', { preHandler: authGuard }, c.meHandler);
  app.get('/me/activity', { preHandler: authGuard }, c.meActivityHandler);
}
