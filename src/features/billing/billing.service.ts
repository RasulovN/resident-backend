import { and, desc, eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../db/client';
import { AppError } from '../../common/errors/app-error';
import { sendMail } from '../../common/utils/mailer';
import { organizations } from '../organizations/organizations.model';
import { subscriptionPlans } from '../subscriptions/subscriptions.model';
import { users } from '../users/users.model';
import { paymentTransactions } from './payment.model';
import * as payme from './payme.service';

const DEFAULT_DURATION_MONTHS = 1;

function makeOrderId(): string {
  return `mahalla-${crypto.randomBytes(8).toString('hex')}`;
}

export type InitiatePaymentResult = {
  token: string;
  phone: string;
  cardMasked: string;
  wait: number;
};

/**
 * Step 1 — tokenize card + request OTP.
 * Returns a Payme card token (valid for a few minutes) and the masked phone.
 */
export async function initiatePayment(params: {
  organizationId: string;
  planId: string;
  cardNumber: string;
  expire: string; // MM/YY
}): Promise<InitiatePaymentResult> {
  const plan = await db.query.subscriptionPlans.findFirst({
    where: and(eq(subscriptionPlans.id, params.planId), eq(subscriptionPlans.isActive, true)),
  });
  if (!plan) throw AppError.notFound('Plan not found');

  const amountUzs = parseFloat(plan.price.toString());
  if (amountUzs <= 0) throw AppError.badRequest('Free plans do not require payment');

  const amountTiyin = payme.uzsTiyin(amountUzs);

  // Step 1: tokenize card
  const tokenizeRes = await payme.tokenizeCard({
    cardNumber: params.cardNumber,
    expire: params.expire,
    amountTiyin,
  });

  // Step 2: request OTP
  const otpRes = await payme.requestOtp(tokenizeRes.card.token);

  return {
    token: tokenizeRes.card.token,
    phone: otpRes.phone,
    cardMasked: tokenizeRes.card.number,
    wait: otpRes.wait,
  };
}

export type ConfirmPaymentResult = {
  transactionId: string;
  cardMasked: string;
  amount: number;
  paidAt: Date;
  subscriptionEndsAt: Date;
};

/**
 * Step 2 — verify OTP → pay → activate subscription.
 */
export async function confirmPayment(params: {
  organizationId: string;
  planId: string;
  cardToken: string;
  otp: string;
  cardMasked: string;
}): Promise<ConfirmPaymentResult> {
  const [org, plan] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, params.organizationId) }),
    db.query.subscriptionPlans.findFirst({
      where: and(eq(subscriptionPlans.id, params.planId), eq(subscriptionPlans.isActive, true)),
    }),
  ]);

  if (!org) throw AppError.notFound('Organization not found');
  if (!plan) throw AppError.notFound('Plan not found');

  const amountUzs = parseFloat(plan.price.toString());
  const amountTiyin = payme.uzsTiyin(amountUzs);

  // Step 3: verify OTP → permanent card token
  await payme.verifyCard(params.cardToken, params.otp);

  // Step 4: create receipt
  const orderId = makeOrderId();
  const { receipt } = await payme.createReceipt({
    amountTiyin,
    orderId,
    description: `Mahalla OS — ${plan.name} (${org.name})`,
  });

  // Step 5: pay
  let paidReceipt: payme.PaymeReceipt;
  try {
    const result = await payme.payReceipt({
      receiptId: receipt._id,
      cardToken: params.cardToken,
    });
    paidReceipt = result.receipt;
  } catch (err) {
    // Save failed transaction for audit
    await db.insert(paymentTransactions).values({
      organizationId: params.organizationId,
      planId: params.planId,
      orderId,
      paymeReceiptId: receipt._id,
      cardMasked: params.cardMasked,
      amount: amountUzs.toString(),
      currency: plan.currency,
      status: 'failed',
      durationMonths: DEFAULT_DURATION_MONTHS.toString(),
    });
    throw err;
  }

  const paidAt = new Date();
  // If subscription is still active, extend from currentPeriodEnd (renewal); else start from now
  const baseDate =
    org.currentPeriodEnd && org.currentPeriodEnd > paidAt ? org.currentPeriodEnd : paidAt;
  const subscriptionEndsAt = new Date(baseDate);
  subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + DEFAULT_DURATION_MONTHS);

  // Save successful transaction
  const [tx] = await db
    .insert(paymentTransactions)
    .values({
      organizationId: params.organizationId,
      planId: params.planId,
      orderId,
      paymeReceiptId: paidReceipt._id,
      cardMasked: params.cardMasked,
      amount: amountUzs.toString(),
      currency: plan.currency,
      status: 'paid',
      durationMonths: DEFAULT_DURATION_MONTHS.toString(),
      paidAt,
    })
    .returning();

  // Activate subscription
  await db
    .update(organizations)
    .set({
      status: 'active',
      subscriptionStatus: 'active',
      subscriptionPlanId: params.planId,
      currentPeriodEnd: subscriptionEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, params.organizationId));

  // Send confirmation email to owner
  try {
    const owner = await db.query.users.findFirst({ where: eq(users.id, org.ownerUserId) });
    if (owner?.email) {
      await sendSubscriptionConfirmEmail({
        to: owner.email,
        orgName: org.name,
        planName: plan.name,
        amount: amountUzs,
        currency: plan.currency,
        endsAt: subscriptionEndsAt,
      });
    }
  } catch {
    // Non-critical — don't fail the payment if email fails
  }

  return {
    transactionId: tx!.id,
    cardMasked: params.cardMasked,
    amount: amountUzs,
    paidAt,
    subscriptionEndsAt,
  };
}

export async function listTransactions(organizationId: string) {
  return db
    .select({
      id: paymentTransactions.id,
      orderId: paymentTransactions.orderId,
      paymeReceiptId: paymentTransactions.paymeReceiptId,
      cardMasked: paymentTransactions.cardMasked,
      amount: paymentTransactions.amount,
      currency: paymentTransactions.currency,
      status: paymentTransactions.status,
      durationMonths: paymentTransactions.durationMonths,
      paidAt: paymentTransactions.paidAt,
      createdAt: paymentTransactions.createdAt,
      planId: paymentTransactions.planId,
    })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.organizationId, organizationId))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(50);
}

async function sendSubscriptionConfirmEmail(params: {
  to: string;
  orgName: string;
  planName: string;
  amount: number;
  currency: string;
  endsAt: Date;
}) {
  const amountFmt = params.amount.toLocaleString('uz-UZ');
  const dateFmt = params.endsAt.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  await sendMail(
    params.to,
    `Obuna faollashtirildi — ${params.orgName}`,
    `Hurmatli foydalanuvchi,\n\n${params.orgName} mahallasi uchun "${params.planName}" obunasi muvaffaqiyatli faollashtirildi.\n\nTo'lov miqdori: ${amountFmt} ${params.currency}\nObuna muddati: ${dateFmt} gacha\n\nMahalla OS tizimidan to'liq foydalanishingiz mumkin.\n\nHurmat bilan,\nMahalla OS jamoasi`,
  );
}
