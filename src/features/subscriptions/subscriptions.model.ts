import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { planIntervalEnum } from '../../db/enums';

export type PlanLimits = {
  maxUsers: number | null;
  maxMenus: number | null;
  maxRecords: number | null;
  features: string[];
};

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('UZS'),
  interval: planIntervalEnum('interval').notNull().default('month'),
  limits: jsonb('limits').$type<PlanLimits>().notNull().default({
    maxUsers: 5,
    maxMenus: 10,
    maxRecords: 1000,
    features: [],
  }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
