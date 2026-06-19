import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { PaymeError } from '../../features/billing/payme.service';
import { env } from '../../config/env';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    if (error instanceof PaymeError) {
      return reply.status(400).send({
        success: false,
        error: { code: 'PAYME_ERROR', message: error.message },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: 'Validation failed',
          details: error.flatten(),
        },
      });
    }

    // Fastify built-in validation / rate-limit errors carry statusCode
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: error.message },
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL',
        message: env.NODE_ENV === 'development' ? (error.message ?? 'Internal server error') : 'Internal server error',
        ...(env.NODE_ENV === 'development' ? { detail: String(error) } : {}),
      },
    });
  });
}
