import { eq } from 'drizzle-orm';
import { db, pool } from './client';
import { env } from '../config/env';
import { hashPassword } from '../common/utils/password';
import { ALL_STATIC_PERMISSIONS } from '../features/permissions/permissions.catalog';
import { permissions, rolePermissions } from '../features/permissions/permissions.model';
import { roles } from '../features/roles/roles.model';
import { subscriptionPlans } from '../features/subscriptions/subscriptions.model';
import { users } from '../features/users/users.model';
import { businessCategories } from '../features/businesses/businesses.model';

async function seed() {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding...');

  // 1. Static permission catalog (idempotent)
  for (const p of ALL_STATIC_PERMISSIONS) {
    await db
      .insert(permissions)
      .values({ key: p.key, description: p.description, scope: p.scope })
      .onConflictDoNothing({ target: permissions.key });
  }

  // 2. Subscription plans — Mahalla OS
  const planDefs = [
    {
      name: 'Asosiy',
      price: '500000',
      currency: 'UZS',
      interval: 'month' as const,
      sortOrder: 0,
      limits: {
        maxUsers: 10,
        maxMenus: null,
        maxRecords: null,
        features: [
          'Aholi registri',
          'Binolar va oilalar',
          'Murojaatlar moduli',
          'Xarita (2D)',
        ],
      },
    },
    {
      name: 'Premium',
      price: '1000000',
      currency: 'UZS',
      interval: 'month' as const,
      sortOrder: 1,
      limits: {
        maxUsers: null,
        maxMenus: null,
        maxRecords: null,
        features: [
          'Barcha Asosiy imkoniyatlar',
          '3D Xarita simulyatsiyasi',
          'Kommunal billing',
          'AI Analitika',
          'Mobil ilova kirish',
          'Demografiya hisobotlari',
        ],
      },
    },
  ];
  for (const p of planDefs) {
    const exists = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, p.name),
    });
    if (!exists) {
      await db.insert(subscriptionPlans).values(p);
    }
  }

  // 3. Platform super admin user — credentials come from env, not hardcoded.
  const adminEmail = env.SEED_ADMIN_EMAIL;
  let admin = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
  if (!admin) {
    [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
        firstName: env.SEED_ADMIN_FIRST_NAME,
        lastName: env.SEED_ADMIN_LAST_NAME,
        status: 'active',
        emailVerified: true,
        isPlatformAdmin: true,
      })
      .returning();
    // eslint-disable-next-line no-console
    console.log(`   created platform admin: ${adminEmail} (password from SEED_ADMIN_PASSWORD)`);
  }

  // 4. Platform "Super Admin" role with all platform permissions
  let superRole = await db.query.roles.findFirst({
    where: eq(roles.name, 'Super Admin'),
  });
  if (!superRole) {
    [superRole] = await db
      .insert(roles)
      .values({ organizationId: null, name: 'Super Admin', description: 'Full platform access', isSystem: true })
      .returning();

    const platformPerms = await db.query.permissions.findMany({
      where: eq(permissions.scope, 'platform'),
    });
    if (platformPerms.length > 0) {
      await db
        .insert(rolePermissions)
        .values(platformPerms.map((p) => ({ roleId: superRole!.id, permissionId: p.id })))
        .onConflictDoNothing();
    }
  }

  // 5. Mahalla OS — default org-level role templates (organizationId: null = template)
  const orgRoleTemplates = [
    {
      name: 'Mahalla Admin',
      description: 'Full access to a single mahalla',
      permissionKeys: [
        'members.create', 'members.read', 'members.update', 'members.delete',
        'roles.read', 'entities.read', 'organization.update',
        'residents.create', 'residents.read', 'residents.update', 'residents.delete',
        'households.read', 'households.manage',
        'buildings.read', 'buildings.manage',
        'map.read', 'map.manage',
        'businesses.read', 'businesses.manage',
        'providers.read', 'providers.manage',
        'inquiries.read', 'inquiries.manage', 'inquiries.escalate',
        'audit.read',
        'utility.read', 'utility.manage',
        'infrastructure.read', 'infrastructure.manage',
        'events.read', 'events.manage',
        'notifications.read', 'notifications.send',
        'reports.read', 'reports.export',
        'ai_reports.read',
        'governor_panel.read',
        'relocations.read', 'relocations.approve',
      ],
    },
    {
      name: 'Staff',
      description: 'Daily operational tasks in a mahalla',
      permissionKeys: [
        'residents.create', 'residents.read', 'residents.update',
        'households.read', 'households.manage',
        'buildings.read',
        'map.read',
        'businesses.read',
        'providers.read',
        'inquiries.read', 'inquiries.manage',
        'audit.read',
        'utility.read',
        'infrastructure.read',
        'events.read', 'events.manage',
        'notifications.send',
        'reports.read',
        'relocations.read',
      ],
    },
    {
      name: 'Governor',
      description: 'Governor/Hokimiyat — escalated and critical cases only',
      permissionKeys: [
        'inquiries.read',
        'governor_panel.read',
        'reports.read',
        'ai_reports.read',
      ],
    },
    {
      name: 'Auditor',
      description: 'Read-only audit access across all domains',
      permissionKeys: [
        'residents.read',
        'households.read',
        'buildings.read',
        'map.read',
        'businesses.read',
        'providers.read',
        'inquiries.read',
        'utility.read',
        'infrastructure.read',
        'events.read',
        'notifications.read',
        'reports.read',
        'relocations.read',
        'audit.read',
      ],
    },
  ];

  const allOrgPerms = await db.query.permissions.findMany({
    where: eq(permissions.scope, 'organization'),
  });
  const permByKey = Object.fromEntries(allOrgPerms.map((p) => [p.key, p]));

  for (const tmpl of orgRoleTemplates) {
    const existing = await db.query.roles.findFirst({ where: eq(roles.name, tmpl.name) });
    const permsToAssign = tmpl.permissionKeys
      .map((k) => permByKey[k])
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    if (!existing) {
      const [newRole] = await db
        .insert(roles)
        .values({ organizationId: null, name: tmpl.name, description: tmpl.description, isSystem: true })
        .returning();
      if (permsToAssign.length > 0) {
        await db
          .insert(rolePermissions)
          .values(permsToAssign.map((p) => ({ roleId: newRole!.id, permissionId: p.id })))
          .onConflictDoNothing();
      }
      // eslint-disable-next-line no-console
      console.log(`   created role template: ${tmpl.name}`);
    } else {
      // Re-sync permissions on existing templates so catalog changes take effect
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, existing.id));
      if (permsToAssign.length > 0) {
        await db
          .insert(rolePermissions)
          .values(permsToAssign.map((p) => ({ roleId: existing.id, permissionId: p.id })))
          .onConflictDoNothing();
      }
      // eslint-disable-next-line no-console
      console.log(`   synced role template: ${tmpl.name}`);
    }
  }

  // 5. Backfill: grant any new org-scoped permissions to all existing Owner roles
  const currentOrgPerms = await db.query.permissions.findMany({
    where: eq(permissions.scope, 'organization'),
  });
  const ownerRoles = await db.query.roles.findMany({
    where: (r, { and, eq: eqOp, isNotNull }) => and(eqOp(r.name, 'Owner'), eqOp(r.isSystem, true), isNotNull(r.organizationId)),
  });
  let backfillCount = 0;
  for (const role of ownerRoles) {
    for (const perm of currentOrgPerms) {
      const inserted = await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId: perm.id })
        .onConflictDoNothing();
      if (inserted.rowCount && inserted.rowCount > 0) backfillCount++;
    }
  }
  if (backfillCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`   backfilled ${backfillCount} permission(s) to existing Owner roles`);
  }

  // 6. Global business categories (organizationId: null — available to all orgs)
  const globalBizCategories = [
    { name: "Oziq-ovqat do'koni",  slug: 'grocery',         icon: '🛒', sortOrder: 1 },
    { name: 'Mini Market',          slug: 'mini-market',     icon: '🏪', sortOrder: 2 },
    { name: 'Restoran',             slug: 'restaurant',      icon: '🍽️', sortOrder: 3 },
    { name: 'Kafe',                 slug: 'cafe',            icon: '☕', sortOrder: 4 },
    { name: 'Non zavodi / Bakery',  slug: 'bakery',          icon: '🥐', sortOrder: 5 },
    { name: 'Dorixona',             slug: 'pharmacy',        icon: '💊', sortOrder: 6 },
    { name: "Go'zallik saloni",     slug: 'beauty-salon',    icon: '💅', sortOrder: 7 },
    { name: 'Sartaroshxona',        slug: 'barbershop',      icon: '✂️', sortOrder: 8 },
    { name: 'Spa / Massaj',         slug: 'spa',             icon: '🧖', sortOrder: 9 },
    { name: "Bolalar bog'chasi",    slug: 'kindergarten',    icon: '🏫', sortOrder: 10 },
    { name: 'Maktab',               slug: 'school',          icon: '📚', sortOrder: 11 },
    { name: "O'quv markazi",        slug: 'training-center', icon: '🎓', sortOrder: 12 },
    { name: 'Fitness Markaz',       slug: 'fitness-center',  icon: '🏋️', sortOrder: 13 },
    { name: 'Klinika',              slug: 'clinic',          icon: '🏥', sortOrder: 14 },
    { name: 'Tish shifoxonasi',     slug: 'dental',          icon: '🦷', sortOrder: 15 },
    { name: 'Elektronika',          slug: 'electronics',     icon: '📱', sortOrder: 16 },
    { name: 'Uy xizmatlari',        slug: 'home-service',    icon: '🔧', sortOrder: 17 },
    { name: 'Qurilish',             slug: 'construction',    icon: '🏗️', sortOrder: 18 },
    { name: 'Avto xizmat',          slug: 'auto-service',    icon: '🚗', sortOrder: 19 },
    { name: 'Mehmonxona',           slug: 'hotel',           icon: '🏨', sortOrder: 20 },
    { name: 'Kimyoviy tozalash',    slug: 'laundry',         icon: '👕', sortOrder: 21 },
    { name: 'Tikuvchilik',          slug: 'tailoring',       icon: '🧵', sortOrder: 22 },
    { name: 'Uy ovqati',            slug: 'home-food',       icon: '🍱', sortOrder: 23 },
    { name: 'Hunarmandchilik',      slug: 'handmade',        icon: '🎨', sortOrder: 24 },
    { name: 'Boshqa',               slug: 'other',           icon: '📦', sortOrder: 25 },
  ];
  let catCount = 0;
  for (const cat of globalBizCategories) {
    const exists = await db.query.businessCategories.findFirst({
      where: (t, { and: a, eq: e, isNull }) => a(e(t.slug, cat.slug), isNull(t.organizationId)),
    });
    if (!exists) {
      await db.insert(businessCategories).values({ organizationId: null, ...cat, isActive: true });
      catCount++;
    }
  }
  if (catCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`   seeded ${catCount} global business categories`);
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete');
  await pool.end();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Seed failed', err);
  process.exit(1);
});
