import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  residents,
  households,
  businesses,
  businessCategories,
  inquiries,
} from '../../db/schema';

/**
 * Topic data functions — one per menu/subject. Each fetches the relevant slice of
 * the mahalla's data from the DB (always org-scoped) and returns a compact JSON
 * object. These are exposed to the model as callable tools (see TOOLS below) so the
 * assistant can pull exactly the data a question needs, and are also called directly
 * by the analyze/forecast/anomaly endpoints.
 */

export async function getResidentsData(orgId: string) {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      male: sql<number>`count(*) filter (where ${residents.gender} = 'male')::int`,
      female: sql<number>`count(*) filter (where ${residents.gender} = 'female')::int`,
      active: sql<number>`count(*) filter (where ${residents.status} = 'active')::int`,
      withVehicle: sql<number>`count(*) filter (where ${residents.hasVehicle} = true)::int`,
      avgAge: sql<number>`coalesce(round(avg(extract(year from age(${residents.birthDate}))))::int, 0)`,
      avgHappiness: sql<number>`coalesce(round(avg(${residents.happinessScore}))::int, 0)`,
      newThisMonth: sql<number>`count(*) filter (where ${residents.createdAt} >= date_trunc('month', now()))::int`,
    })
    .from(residents)
    .where(eq(residents.mahallaId, orgId));

  const byEmployment = await db
    .select({ key: residents.employmentStatus, count: sql<number>`count(*)::int` })
    .from(residents)
    .where(eq(residents.mahallaId, orgId))
    .groupBy(residents.employmentStatus);

  return { ...totals, byEmployment: byEmployment.filter((r) => r.key) };
}

export async function getHouseholdsData(orgId: string) {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      avgHappiness: sql<number>`coalesce(round(avg(${households.happinessScore}))::int, 0)`,
    })
    .from(households)
    .where(eq(households.mahallaId, orgId));

  const [res] = await db
    .select({ residents: sql<number>`count(*)::int` })
    .from(residents)
    .where(eq(residents.mahallaId, orgId));

  const total = totals?.total ?? 0;
  const residentCount = res?.residents ?? 0;
  const avgSize = total > 0 ? Math.round((residentCount / total) * 10) / 10 : 0;
  return {
    total,
    avgHappiness: totals?.avgHappiness ?? 0,
    residents: residentCount,
    avgHouseholdSize: avgSize,
  };
}

export async function getBusinessesData(orgId: string) {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${businesses.verificationStatus} = 'APPROVED')::int`,
      pending: sql<number>`count(*) filter (where ${businesses.verificationStatus} = 'PENDING')::int`,
      active: sql<number>`count(*) filter (where ${businesses.status} = 'active')::int`,
      avgRating: sql<number>`coalesce(round(avg(nullif(${businesses.averageRating}, 0))::numeric, 2), 0)`,
      totalViews: sql<number>`coalesce(sum(${businesses.totalViews}), 0)::int`,
    })
    .from(businesses)
    .where(eq(businesses.organizationId, orgId));

  const byCategory = await db
    .select({ category: businessCategories.name, count: sql<number>`count(*)::int` })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .where(eq(businesses.organizationId, orgId))
    .groupBy(businessCategories.name)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  return { ...totals, byCategory: byCategory.filter((c) => c.category) };
}

export async function getInquiriesData(orgId: string) {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      newCount: sql<number>`count(*) filter (where ${inquiries.status} = 'NEW')::int`,
      inProgress: sql<number>`count(*) filter (where ${inquiries.status} = 'IN_PROGRESS')::int`,
      resolved: sql<number>`count(*) filter (where ${inquiries.status} in ('RESOLVED','CLOSED'))::int`,
      escalated: sql<number>`count(*) filter (where ${inquiries.escalated} = true)::int`,
      overdue: sql<number>`count(*) filter (where ${inquiries.dueAt} < now() and ${inquiries.status} not in ('RESOLVED','CLOSED','REJECTED'))::int`,
      avgRating: sql<number>`coalesce(round(avg(${inquiries.rating})::numeric, 2), 0)`,
      resolvedThisMonth: sql<number>`count(*) filter (where ${inquiries.resolvedAt} >= date_trunc('month', now()))::int`,
    })
    .from(inquiries)
    .where(eq(inquiries.organizationId, orgId));

  const byCategory = await db
    .select({ category: inquiries.category, count: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(eq(inquiries.organizationId, orgId))
    .groupBy(inquiries.category)
    .orderBy(sql`count(*) desc`);

  const byPriority = await db
    .select({ priority: inquiries.priority, count: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(eq(inquiries.organizationId, orgId))
    .groupBy(inquiries.priority);

  return { ...totals, byCategory, byPriority };
}

export async function getOverviewData(orgId: string) {
  const [r, h, b, i] = await Promise.all([
    getResidentsData(orgId),
    getHouseholdsData(orgId),
    getBusinessesData(orgId),
    getInquiriesData(orgId),
  ]);
  return {
    residents: { total: r.total, male: r.male, female: r.female, avgAge: r.avgAge },
    households: { total: h.total, avgHouseholdSize: h.avgHouseholdSize },
    businesses: { total: b.total, approved: b.approved },
    inquiries: { total: i.total, new: i.newCount, resolved: i.resolved, overdue: i.overdue },
  };
}

// ─── Tool registry (executors + Ollama tool schema) ───────────────────────────

export type ToolName =
  | 'get_overview'
  | 'get_residents'
  | 'get_households'
  | 'get_businesses'
  | 'get_inquiries';

export const TOOL_EXECUTORS: Record<ToolName, (orgId: string) => Promise<unknown>> = {
  get_overview: getOverviewData,
  get_residents: getResidentsData,
  get_households: getHouseholdsData,
  get_businesses: getBusinessesData,
  get_inquiries: getInquiriesData,
};

export async function executeTool(name: string, orgId: string): Promise<unknown> {
  const fn = TOOL_EXECUTORS[name as ToolName];
  if (!fn) return { error: `Unknown tool: ${name}` };
  try {
    return await fn(orgId);
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const noArgs = { type: 'object', properties: {} as Record<string, unknown> };

// Ollama / OpenAI-style tool definitions advertised to the model.
export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_overview',
      description:
        "Mahalla bo'yicha umumiy ko'rsatkichlar: aholi, xonadonlar, bizneslar va murojaatlar soni. Umumiy yoki aralash savollar uchun.",
      parameters: noArgs,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_residents',
      description:
        "Aholi (residents) statistikasi: jami soni, jinsi bo'yicha, o'rtacha yosh, bandlik holati, transport, yangi qo'shilganlar. Aholi/demografiya savollari uchun.",
      parameters: noArgs,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_households',
      description:
        "Xonadonlar (households) statistikasi: jami soni, o'rtacha oila a'zolari soni, baxtlilik darajasi. Oila/xonadon savollari uchun.",
      parameters: noArgs,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_businesses',
      description:
        "Bizneslar statistikasi: jami soni, tasdiqlangan/kutilayotgan, o'rtacha reyting, kategoriyalar bo'yicha taqsimot. Biznes savollari uchun.",
      parameters: noArgs,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inquiries',
      description:
        "Murojaatlar (inquiries) statistikasi: status, kategoriya, ustuvorlik bo'yicha taqsimot, muddati o'tganlar, o'rtacha baho. Murojaat/shikoyat savollari uchun.",
      parameters: noArgs,
    },
  },
];
