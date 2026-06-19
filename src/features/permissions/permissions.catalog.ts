// Static permission catalog. Dynamic permissions (menu.{id}.view,
// entity.{id}.create, ...) are generated at runtime when menus/entities are created.

type PermissionDef = { key: string; description: string; scope: 'platform' | 'organization' };

// Resource + CRUD helper
function crud(resource: string, scope: 'platform' | 'organization'): PermissionDef[] {
  return ['create', 'read', 'update', 'delete'].map((action) => ({
    key: `${resource}.${action}`,
    description: `${action} ${resource}`,
    scope,
  }));
}

export const PLATFORM_PERMISSIONS: PermissionDef[] = [
  ...crud('organizations', 'platform'),
  ...crud('platform_users', 'platform'),
  ...crud('plans', 'platform'),
  ...crud('platform_roles', 'platform'),
];

export const ORGANIZATION_PERMISSIONS: PermissionDef[] = [
  // Tizim
  ...crud('members', 'organization'),
  ...crud('roles', 'organization'),
  ...crud('entities', 'organization'),
  ...crud('menus', 'organization'),
  { key: 'organization.update', description: 'update organization settings', scope: 'organization' },
  // Mahalla OS — Aholi registri
  ...crud('residents', 'organization'),
  { key: 'households.read', description: 'read households', scope: 'organization' },
  { key: 'households.manage', description: 'manage households', scope: 'organization' },
  // Mahalla OS — Ko'chmas mulk
  { key: 'buildings.read', description: "read property: streets, houses, buildings, apartments, yards", scope: 'organization' },
  { key: 'buildings.manage', description: "manage property objects", scope: 'organization' },
  // Mahalla OS — Xarita
  { key: 'map.read', description: 'view 2D/3D mahalla map', scope: 'organization' },
  { key: 'map.manage', description: 'manage map objects and layers', scope: 'organization' },
  // Mahalla OS — Bizneslar
  { key: 'businesses.read', description: 'read business registry', scope: 'organization' },
  { key: 'businesses.manage', description: 'manage businesses', scope: 'organization' },
  // Mahalla OS — Xizmat ko'rsatuvchilar
  { key: 'providers.read', description: 'read service providers', scope: 'organization' },
  { key: 'providers.manage', description: 'manage and verify service providers', scope: 'organization' },
  // Mahalla OS — Murojaatlar
  { key: 'inquiries.read', description: 'read inquiries', scope: 'organization' },
  { key: 'inquiries.manage', description: 'manage inquiries', scope: 'organization' },
  { key: 'inquiries.escalate', description: 'escalate inquiries to governor', scope: 'organization' },
  // Mahalla OS — Faollik loglari (audit)
  { key: 'audit.read', description: 'read activity logs for the mahalla', scope: 'organization' },
  // Mahalla OS — Kommunal xizmatlar
  { key: 'utility.read', description: 'read utility accounts and bills', scope: 'organization' },
  { key: 'utility.manage', description: 'manage utility readings and bills', scope: 'organization' },
  // Mahalla OS — Infratuzilma
  { key: 'infrastructure.read', description: 'read infrastructure assets', scope: 'organization' },
  { key: 'infrastructure.manage', description: 'manage infrastructure assets and repairs', scope: 'organization' },
  // Mahalla OS — Tadbirlar
  { key: 'events.read', description: 'read events and life events', scope: 'organization' },
  { key: 'events.manage', description: 'manage events', scope: 'organization' },
  // Mahalla OS — Xabarnomalar
  { key: 'notifications.read', description: 'read notifications and campaigns', scope: 'organization' },
  { key: 'notifications.send', description: 'send notifications, SMS and alerts', scope: 'organization' },
  // Mahalla OS — Jamoa chati
  { key: 'chats.read', description: 'read community chat rooms and messages', scope: 'organization' },
  { key: 'chats.manage', description: 'create and moderate community chat rooms', scope: 'organization' },
  // Mahalla OS — Hisobotlar
  { key: 'reports.read', description: 'read all reports and statistics', scope: 'organization' },
  { key: 'reports.export', description: 'export reports to PDF/Excel', scope: 'organization' },
  // Mahalla OS — AI Analitika
  { key: 'ai_reports.read', description: 'read AI analytics and recommendations', scope: 'organization' },
  // Mahalla OS — Governor paneli
  { key: 'governor_panel.read', description: 'access governor panel', scope: 'organization' },
  // Mahalla OS — Ko'chishlar
  { key: 'relocations.read', description: 'read relocation requests', scope: 'organization' },
  { key: 'relocations.approve', description: 'approve relocation requests', scope: 'organization' },
];

export const ALL_STATIC_PERMISSIONS = [...PLATFORM_PERMISSIONS, ...ORGANIZATION_PERMISSIONS];
