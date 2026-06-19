import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { grantPermissionToOwnerRole } from '../permissions/permissions.service';
import { permissions } from '../permissions/permissions.model';
import { menus, type Menu } from './menus.model';
import type { CreateMenuInput, UpdateMenuInput } from './menus.schema';

export const menuViewPermissionKey = (menuId: string) => `menu.${menuId}.view`;

export type MenuNode = Menu & { children: MenuNode[] };

function buildTree(rows: Menu[]): MenuNode[] {
  const byId = new Map<string, MenuNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: MenuNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (nodes: MenuNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export async function listMenus(organizationId: string) {
  return db.query.menus.findMany({
    where: eq(menus.organizationId, organizationId),
    orderBy: [asc(menus.sortOrder)],
  });
}

export async function getMenuTree(organizationId: string) {
  const rows = await listMenus(organizationId);
  return buildTree(rows);
}

async function assertParentInOrg(organizationId: string, parentId?: string | null) {
  if (!parentId) return;
  const parent = await db.query.menus.findFirst({
    where: and(eq(menus.id, parentId), eq(menus.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!parent) throw AppError.badRequest('Parent menu not found in this organization');
}

export async function createMenu(organizationId: string, input: CreateMenuInput) {
  await assertParentInOrg(organizationId, input.parentId);

  return db.transaction(async (tx) => {
    const [menu] = await tx
      .insert(menus)
      .values({
        organizationId,
        name: input.name,
        icon: input.icon,
        path: input.path,
        type: input.type,
        parentId: input.parentId ?? null,
        entityId: input.entityId ?? null,
        displayConfig: input.displayConfig,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      })
      .returning();

    // auto-generate a dynamic "view" permission for this menu
    const [perm] = await tx
      .insert(permissions)
      .values({
        key: menuViewPermissionKey(menu!.id),
        description: `View menu: ${menu!.name}`,
        scope: 'organization',
        isDynamic: true,
      })
      .returning();

    // grant it to the org Owner role so the creator can see it immediately
    await grantPermissionToOwnerRole(tx, organizationId, perm!.id);

    return menu!;
  });
}

async function getMenuInOrg(organizationId: string, id: string) {
  const menu = await db.query.menus.findFirst({
    where: and(eq(menus.id, id), eq(menus.organizationId, organizationId)),
  });
  if (!menu) throw AppError.notFound('Menu not found');
  return menu;
}

export async function updateMenu(organizationId: string, id: string, input: UpdateMenuInput) {
  await getMenuInOrg(organizationId, id);
  if (input.parentId) {
    if (input.parentId === id) throw AppError.badRequest('A menu cannot be its own parent');
    await assertParentInOrg(organizationId, input.parentId);
  }

  const [updated] = await db
    .update(menus)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.path !== undefined ? { path: input.path } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.displayConfig !== undefined ? { displayConfig: input.displayConfig } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(menus.id, id))
    .returning();
  return updated!;
}

export async function deleteMenu(organizationId: string, id: string) {
  await getMenuInOrg(organizationId, id);
  await db.transaction(async (tx) => {
    await tx.delete(permissions).where(eq(permissions.key, menuViewPermissionKey(id)));
    await tx.delete(menus).where(eq(menus.id, id)); // children cascade via FK
  });
}

export async function reorderMenus(
  organizationId: string,
  items: Array<{ id: string; sortOrder: number }>,
) {
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(menus)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(menus.id, item.id), eq(menus.organizationId, organizationId)));
    }
  });
}
