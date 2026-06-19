import { env } from '../../config/env';

// const PAYME_API_URL = 'https://api.amaar.uz/api/v1/orders/payment/update/';
const TEST_URL = 'https://checkout.test.paycom.uz/api';
const PROD_URL = 'https://checkout.paycom.uz/api';

function getBaseUrl() {
  return TEST_URL;
}

function getAuthHeader() {
  const id = env.PAYME_MERCHANT_ID ?? '';
  const key = env.PAYME_MERCHANT_KEY ?? '';
  const token = Buffer.from(`${id}:${key}`).toString('base64');
  return { 'X-Auth': `${id}:${key}`, Authorization: `Basic ${token}` };
}

function assertCredentials() {
  const id = env.PAYME_MERCHANT_ID ?? '';
  const key = env.PAYME_MERCHANT_KEY ?? '';
  if (!id || !key || key === 'YOUR_CHECKOUT_KEY_HERE') {
    throw new PaymeError(
      -1,
      "To'lov tizimi sozlanmagan. .env faylida PAYME_MERCHANT_ID va PAYME_MERCHANT_KEY ni to'ldiring.",
    );
  }
}

async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  assertCredentials();

  let res: Response;
  try {
    res = await fetch(getBaseUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ id: Date.now(), jsonrpc: '2.0', method, params }),
    });
  } catch (err) {
    throw new PaymeError(-1, `To'lov serveriga ulanib bo'lmadi: ${(err as Error).message}`);
  }

  let json: { result?: T; error?: { code: number; message: string | { ru: string; uz: string; en: string } } };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new PaymeError(-1, `To'lov serveridan noto'g'ri javob (HTTP ${res.status})`);
  }

  if (json.error) {
    const msg =
      typeof json.error.message === 'string'
        ? json.error.message
        : (json.error.message?.uz ?? json.error.message?.ru ?? 'Payme xatosi');
    throw new PaymeError(json.error.code, msg);
  }
  return json.result as T;
}

export class PaymeError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'PaymeError';
  }
}

export type PaymeCard = {
  token: string;
  number: string;
  expire: string;
  type: string;
  verify: boolean;
  recurrent: boolean;
};

export type TokenizeResult = {
  card: PaymeCard;
  phone?: string;
  wait?: number;
};

/** Step 1: Submit card details → get temp token, trigger OTP SMS */
export async function tokenizeCard(params: {
  cardNumber: string;
  expire: string; // MM/YY
  amountTiyin: number;
}): Promise<TokenizeResult> {
  // Payme expects expire as MMYY (4 digits, no slash)
  const expire = params.expire.replace('/', '');

  return rpc<TokenizeResult>('cards.create', {
    card: { number: params.cardNumber.replace(/\s/g, ''), expire },
    amount: params.amountTiyin,
    save: true,
  });
}

/** Step 2: Request OTP SMS to be sent to card's registered phone */
export async function requestOtp(token: string): Promise<{ sent: boolean; phone: string; wait: number }> {
  return rpc<{ sent: boolean; phone: string; wait: number }>('cards.get_verify_code', { token });
}

/** Step 3: Verify OTP → card becomes verified and ready for payment */
export async function verifyCard(token: string, code: string): Promise<{ card: PaymeCard }> {
  return rpc<{ card: PaymeCard }>('cards.verify', { token, code });
}

export type PaymeReceipt = {
  _id: string;
  create_time: number;
  pay_time?: number;
  amount: number;
  state: number; // 0=pending, 1=pending, 2=paid, -1=cancelled
  type: number;
  external?: string;
  description?: string;
};

/** Step 4: Create a payment receipt */
export async function createReceipt(params: {
  amountTiyin: number;
  orderId: string;
  description: string;
}): Promise<{ receipt: PaymeReceipt }> {
  return rpc<{ receipt: PaymeReceipt }>('receipts.create', {
    amount: params.amountTiyin,
    order_id: params.orderId,
    description: params.description,
  });
}

/** Step 5: Pay the receipt with verified card token */
export async function payReceipt(params: {
  receiptId: string;
  cardToken: string;
  phone?: string;
}): Promise<{ receipt: PaymeReceipt }> {
  return rpc<{ receipt: PaymeReceipt }>('receipts.pay', {
    id: params.receiptId,
    token: params.cardToken,
    ...(params.phone ? { payer: { phone: params.phone } } : {}),
  });
}

/** Cancel a receipt */
export async function cancelReceipt(receiptId: string): Promise<{ receipt: PaymeReceipt }> {
  return rpc<{ receipt: PaymeReceipt }>('receipts.cancel', { id: receiptId });
}

/** Check receipt status */
export async function checkReceipt(receiptId: string): Promise<{ receipt: PaymeReceipt }> {
  return rpc<{ receipt: PaymeReceipt }>('receipts.check', { id: receiptId });
}

/** Convert UZS to tiyin (×100) */
export function uzsTiyin(uzs: number): number {
  return Math.round(uzs * 100);
}
