import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { subscriptionPlans } from './subscriptions.model';
import type { CreatePlanInput, UpdatePlanInput } from './subscriptions.schema';

export async function listPlans(activeOnly = true) {
  return db.query.subscriptionPlans.findMany({
    where: activeOnly ? eq(subscriptionPlans.isActive, true) : undefined,
    orderBy: [asc(subscriptionPlans.sortOrder)],
  });
}

export async function createPlan(input: CreatePlanInput) {
  const [plan] = await db.insert(subscriptionPlans).values(input).returning();
  return plan!;
}

export async function updatePlan(id: string, input: UpdatePlanInput) {
  const [updated] = await db
    .update(subscriptionPlans)
    .set(input)
    .where(eq(subscriptionPlans.id, id))
    .returning();
  if (!updated) throw AppError.notFound('Plan not found');
  return updated;
}

export async function deletePlan(id: string) {
  const [deleted] = await db
    .delete(subscriptionPlans)
    .where(eq(subscriptionPlans.id, id))
    .returning({ id: subscriptionPlans.id });
  if (!deleted) throw AppError.notFound('Plan not found');
}
