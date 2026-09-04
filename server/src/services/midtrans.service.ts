import { Snap, CoreApi } from 'midtrans-client';
import { Decimal } from 'decimal.js';

const snap = new Snap({
  isProduction: process.env.MIDTRANS_ENV === 'production',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
});

const coreApi = new CoreApi({
  isProduction: process.env.MIDTRANS_ENV === 'production',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
});

export interface PaymentPayload {
  userId: string;
  amountIDR: number;
  isBooster: boolean;
  discount?: number; // bonus diskon Booster
  orderType: 'registration' | 'token_topup' | 'package';
  packageType?: 'basic' | 'pro' | 'premium';
  orderId?: string;
}

/** 1️⃣ Create Snap Token untuk registration / token topup */
export async function createSnapToken(payload: PaymentPayload): Promise<string> {
  const { userId, amountIDR, orderType, isBooster, discount, orderId, packageType } = payload;

  const order_id = orderId || `${orderType}_${userId.substring(0, 24)}_${Date.now()}`;
  const gross_amount = new Decimal(amountIDR).mul(1 - (discount || 0)).toNumber();

  const parameter = {
    order_id,
    gross_amount: gross_amount,
    items: [
      {
        id: orderType === 'registration' ? 'reg_fee' : orderType === 'package' ? `pkg_${packageType}` : 'token_topup',
        price: gross_amount,
        quantity: 1,
        name:
          orderType === 'registration'
            ? 'Registration & AI Trading Access'
            : orderType === 'package'
            ? `AI Trading Package - ${packageType?.toUpperCase()}`
            : 'LLM Token Topup',
      },
    ],
    transaction_details: {
      order_id,
      gross_amount,
    },
    customer_details: { email: `user_${userId}@example.com` },
    enabled_payments: ['bank_transfer', 'echannel', 'gopay', 'ovo', 'dana'],
  };

  const token: string = await snap.createTransactionToken(parameter);
  return token;
}

/** 2️⃣ Verifikasi status transaksi */
export async function getTransactionStatus(orderId: string) {
  const status = await coreApi.transaction.status(orderId);
  return status;
}

/** 3️⃣ Refund (jika diperlukan) */
export async function refundTransaction(
  orderId: string,
  amount?: number,
  reason?: string
) {
  const refund = await coreApi.transaction.refund(orderId, { amount, reason });
  return refund;
}