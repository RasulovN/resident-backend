import type { FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../common/utils/response';
import { getEffectivePermissions, listPermissions } from './permissions.service';

// Catalog of organization-scoped permissions (for building roles in the org UI).
export async function listOrgCatalogHandler(_request: FastifyRequest, reply: FastifyReply) {
  const perms = await listPermissions('organization');
  return reply.send(ok(perms));
}

// Effective permission keys for the current user in the active organization.
// Platform admins receive the wildcard '*'.
export async function myPermissionsHandler(request: FastifyRequest, reply: FastifyReply) {
  if (request.authUser!.isPlatformAdmin) {
    return reply.send(ok({ permissions: ['*'] }));
  }
  const perms = await getEffectivePermissions(request.authUser!.id, request.organizationId!);
  return reply.send(ok({ permissions: [...perms] }));
}
