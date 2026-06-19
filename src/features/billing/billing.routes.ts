import type { FastifyInstance } from 'fastify';
import { tenantContext } from '../../common/middleware/tenant';
import * as c from './billing.controller';

export async function billingRoutes(app: FastifyInstance) {
  // Payme merchant webhook — no auth (Payme uses its own auth header)
  app.post('/payme/merchant', c.paymeWebhookHandler);

  // Org billing — auth + tenant required (tenantContext includes authGuard)
  app.register(async (sub) => {
    sub.addHook('preHandler', tenantContext);
    sub.get('/transactions', c.transactionsHandler);
    sub.post('/initiate', c.initiateHandler);
    sub.post('/confirm', c.confirmHandler);
  });
}
