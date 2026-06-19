import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error';
import { isOrganizationMember } from '../../features/permissions/permissions.service';
import { authGuard } from './auth';

const ORG_HEADER = 'x-organization-id';

/**
 * Resolves the active organization from the `X-Organization-Id` header and
 * verifies the authenticated user belongs to it (platform admins bypass the
 * membership check). Sets request.organizationId.
 */
export async function tenantContext(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    await authGuard(request, reply);
  }
  const orgId = request.headers[ORG_HEADER];
  if (typeof orgId !== 'string' || orgId.length === 0) {
    throw AppError.badRequest('Missing X-Organization-Id header');
  }

  const user = request.authUser!;
  if (!user.isPlatformAdmin) {
    const member = await isOrganizationMember(user.id, orgId);
    if (!member) {
      throw AppError.forbidden('You do not belong to this organization');
    }
  }

  request.organizationId = orgId;
}
