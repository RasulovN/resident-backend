import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error';
import { getEffectivePermissions } from '../../features/permissions/permissions.service';

/**
 * Returns a preHandler that ensures the user has the required permission key
 * within the active organization. Requires tenantContext to have run first.
 * Platform admins bypass all checks.
 */
export function requirePermission(key: string) {
  return async function permissionGuard(request: FastifyRequest, _reply: FastifyReply) {
    const user = request.authUser;
    if (!user) throw AppError.unauthorized();
    if (user.isPlatformAdmin) return;

    const orgId = request.organizationId;
    if (!orgId) throw AppError.badRequest('Organization context required');

    const perms = await getEffectivePermissions(user.id, orgId);
    if (!perms.has(key)) {
      throw AppError.forbidden(`Missing permission: ${key}`);
    }
  };
}

/**
 * Dynamic permission guard for per-entity record operations. Builds the key
 * `entity.{entityId}.{action}` from the route param. Platform admins bypass.
 */
export function requireEntityPermission(action: 'create' | 'read' | 'update' | 'delete') {
  return async function entityPermissionGuard(request: FastifyRequest, _reply: FastifyReply) {
    const user = request.authUser;
    if (!user) throw AppError.unauthorized();
    if (user.isPlatformAdmin) return;

    const orgId = request.organizationId;
    if (!orgId) throw AppError.badRequest('Organization context required');

    const { entityId } = request.params as { entityId?: string };
    if (!entityId) throw AppError.badRequest('Entity id required');

    const perms = await getEffectivePermissions(user.id, orgId);
    if (!perms.has(`entity.${entityId}.${action}`)) {
      throw AppError.forbidden(`Missing permission: entity.${entityId}.${action}`);
    }
  };
}
