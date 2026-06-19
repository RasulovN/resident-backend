import { sql } from 'drizzle-orm';
import { numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.model';
import { subscriptionPlans } from '../subscriptions/subscriptions.model';

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'cancelled',
  'failed',
]);

export const paymentTransactions = pgTable('payment_transactions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => subscriptionPlans.id, { onDelete: 'set null' }),
  // Our internal order reference sent to Payme
  orderId: text('order_id').notNull().unique(),
  // Payme receipt _id returned from receipts.create
  paymeReceiptId: text('payme_receipt_id'),
  // Masked card (e.g. "8600 **** **** 0002")
  cardMasked: text('card_masked'),
  // Amount in UZS (not tiyin)
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('UZS'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  // Duration purchased (months)
  durationMonths: numeric('duration_months', { precision: 3, scale: 0 }).notNull().default('1'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;
