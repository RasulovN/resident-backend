import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '../../common/utils/response';
import { platformAdminGuard } from '../../common/middleware/auth';
import * as roleSvc from './roles.service';
import * as memberSvc from '../members/members.service';
import * as rbac from './admin-rbac.service';

const idParam = z.object({ id: z.string().uuid() });

/**
 * Platform super-admin RBAC management across ALL mahallas.
 * Reuses the org-scoped role/member services by resolving the target org first.
 * Registered at /api/admin (paths: /roles, /permissions, /organizations/:orgId/members, /members/:id).
 */
export async function adminRbacRoutes(app: FastifyInstance) {
  app.addHook('preHandler', platformAdminGuard);

  // ── Roles ───────────────────────────────────────────────────────────────────
  app.get('/roles', async (req, reply) => {
    const q = z.object({
      organizationId: z.string().uuid().optional(),
      search: z.string().optional(),
    }).parse(req.query);
    return reply.send(ok(await rbac.listAllRoles(q)));
  });

  app.get('/roles/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const orgId = await rbac.getRoleOrgId(id);
    return reply.send(ok(await roleSvc.getRole(orgId, id)));
  });

  app.post('/roles', async (req, reply) => {
    const body = z.object({
      organizationId: z.string().uuid(),
      name: z.string().min(2).max(80),
      description: z.string().max(255).optional(),
      permissionIds: z.array(z.string().uuid()).default([]),
    }).parse(req.body);
    const role = await roleSvc.createRole(body.organizationId, {
      name: body.name,
      description: body.description,
      permissionIds: body.permissionIds,
    });
    return reply.status(201).send(ok(role));
  });

  app.patch('/roles/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({
      name: z.string().min(2).max(80).optional(),
      description: z.string().max(255).optional(),
      permissionIds: z.array(z.string().uuid()).optional(),
    }).parse(req.body);
    const orgId = await rbac.getRoleOrgId(id);
    return reply.send(ok(await roleSvc.updateRole(orgId, id, body)));
  });

  app.delete('/roles/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const orgId = await rbac.getRoleOrgId(id);
    await roleSvc.deleteRole(orgId, id);
    return reply.send(ok({ deleted: true }));
  });

  app.get('/permissions', async (_req, reply) => {
    return reply.send(ok(await rbac.listOrgPermissions()));
  });

  // ── Members & role assignment (per mahalla) ──────────────────────────────────
  app.get('/organizations/:orgId/members', async (req, reply) => {
    const { orgId } = z.object({ orgId: z.string().uuid() }).parse(req.params);
    return reply.send(ok(await memberSvc.listMembers(orgId)));
  });

  app.post('/organizations/:orgId/members', async (req, reply) => {
    const { orgId } = z.object({ orgId: z.string().uuid() }).parse(req.params);
    const body = z.object({
      email: z.string().email(),
      firstName: z.string().max(80).optional(),
      lastName: z.string().max(80).optional(),
      password: z.string().min(8).max(128).optional(),
      roleIds: z.array(z.string().uuid()).default([]),
    }).parse(req.body);
    return reply.status(201).send(ok(await memberSvc.addMember(orgId, req.authUser!.id, body)));
  });

  app.patch('/members/:memberId', async (req, reply) => {
    const { memberId } = z.object({ memberId: z.string().uuid() }).parse(req.params);
    const body = z.object({
      status: z.enum(['invited', 'active', 'suspended']).optional(),
      roleIds: z.array(z.string().uuid()).optional(),
    }).parse(req.body);
    const member = await rbac.getMemberOrg(memberId);
    return reply.send(ok(await memberSvc.updateMember(member.organizationId, memberId, body)));
  });

  app.delete('/members/:memberId', async (req, reply) => {
    const { memberId } = z.object({ memberId: z.string().uuid() }).parse(req.params);
    const member = await rbac.getMemberOrg(memberId);
    const ownerId = await rbac.getOrgOwnerId(member.organizationId);
    await memberSvc.removeMember(member.organizationId, memberId, ownerId ?? '');
    return reply.send(ok({ deleted: true }));
  });
}
