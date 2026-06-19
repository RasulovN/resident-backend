import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: {
      id: string;
      isPlatformAdmin: boolean;
    };
    organizationId?: string;
  }
}
