import crypto from "crypto";
import mongoose from "mongoose";
import { authMongoClient } from "../db/mongoose";
import { env } from "../config/env";
import { Registration } from "../models/Registration";
import { Subscription } from "../models/Subscription";
import { TokenBalance } from "../models/TokenBalance";
import { Transaction } from "../models/Transaction";
import {
  ORDER_PREFIX,
  ORDER_PREFIX_LEGACY,
  getTokenQuota,
  PRICING,
} from "../config/payment-pricing";

/**
 * Midtrans signature verification.
 * Hash = sha512(order_id + status_code + gross_amount + serverKey)
 *
 * B9: pembandingan memakai `crypto.timingSafeEqual` supaya tidak bocor via timing.
 */
export function verifyMidtransSignature(payload: any): boolean {
  const { order_id, status_code, gross_amount, signature_key } = payload;
  if (
    typeof order_id !== "string" ||
    typeof status_code !== "string" ||
    typeof gross_amount !== "string" ||
    typeof signature_key !== "string"
  ) {
    return false;
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;

  const computed = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + serverKey)
    .digest("hex");

  const provided = Buffer.from(signature_key, "utf8");
  if (provided.length !== computed.length) return false;

  return crypto.timingSafeEqual(Buffer.from(computed, "utf8"), provided);
}

/**
 * Normalize a user identifier to a Mongo key.
 * better-auth ids are 24-hex ObjectIds in production; legacy/test ids may be plain strings.
 * Cast only when valid so mixed data never throws a BSONError.
 */
function toUserId(userId: string): any {
  return mongoose.isValidObjectId(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;
}

/** Nama koleksi better-auth yang menyimpan user. */
const AUTH_USER_COLLECTION = "user";

interface PaymentContext {
  userId: string;
  orderType: "registration" | "package";
  packageType?: "basic" | "pro" | "premium";
}

/**
 * Extract userId + orderType from Midtrans order_id.
 *
 * Prefix kanonik (`reg_` / `pkg_`) dan prefix legacy
 * (`registration_`, `package_`) dikenali. Prefix lain = null.
 * Semua prefix diambil dari konstanta `ORDER_PREFIX*` — tidak ada literal tersebar.
 */
export function parseOrderId(order_id: string): PaymentContext | null {
  if (typeof order_id !== "string" || order_id.length === 0) return null;

  // Match the longest supported prefix before parsing the user payload.
  const candidates = ["registration", "package"];
  let matched: { orderType: "registration" | "package"; rest: string } | null = null;
  for (const candidate of candidates) {
    if (!order_id.startsWith(candidate + "_")) continue;
    const orderType = resolveOrderType(candidate);
    if (!orderType) continue;
    const rest = order_id.slice(candidate.length + 1);
    if (!matched || candidate.length > matched.rest.length) {
      matched = { orderType, rest };
    }
  }
  if (!matched) return null;

  const parts = matched.rest.split("_");
  if (parts.length < 2) return null;

  const timestamp = parts.pop()!;
  if (!/^\d+$/.test(timestamp)) return null;

  const lastPart = parts[parts.length - 1];

  let packageType: "basic" | "pro" | "premium" | undefined;
  if (lastPart === "basic" || lastPart === "pro" || lastPart === "premium") {
    packageType = parts.pop()! as "basic" | "pro" | "premium";
  }

  const userId = parts.join("_");
  if (!userId) return null;

  // packageType hanya sah untuk paket.
  if (matched.orderType !== "package") packageType = undefined;

  return { userId, orderType: matched.orderType, packageType };
}

/** Peta prefix (kanonik + legacy) -> orderType. */
function resolveOrderType(prefix: string): "registration" | "package" | null {
  for (const orderType of ["registration", "package"] as const) {
    const canonical = ORDER_PREFIX[orderType];
    if (prefix === canonical) return orderType;
    const legacy = ORDER_PREFIX_LEGACY[orderType];
    if ((legacy as readonly string[]).includes(prefix)) return orderType;
  }
  return null;
}

/**
 * Lookup user better-auth. Dipakai `authMongoClient` (koneksi dedicated better-auth),
 * bukan `mongoose.connection.db` — keduanya bisa menunjuk DB berbeda.
 */
async function findAuthUser(userId: string): Promise<any> {
  const db = authMongoClient.db(env.DATABASE_NAME);
  const key = toUserId(userId);
  return db.collection(AUTH_USER_COLLECTION).findOne({
    $or: [{ _id: key }, { _id: userId }, { id: userId }],
  });
}

/**
 * B6: tambah kuota token TANPA menimpa saldo / is_unlimited yang sudah ada.
 *  - tokenQuota null (premium unlimited) -> `$set` is_unlimited=true, saldo tidak disentuh
 *  - tokenQuota angka -> `$inc` balance, `is_unlimited` tidak ditulis
 *  - dokumen belum ada -> dibuat dengan saldo awal = kuota
 */
async function creditTokenBalance(
  userObjectId: any,
  tokenQuota: number | null,
  initialBalanceIfNew: number
): Promise<void> {
  const baseFilter = { user_id: userObjectId };
  const existing = await TokenBalance.findOne(baseFilter).lean();

  const isUnlimited = tokenQuota === null;
  const quota = tokenQuota ?? 0;

  if (!existing) {
    await TokenBalance.findOneAndUpdate(
      baseFilter,
      {
        $setOnInsert: {
          user_id: userObjectId,
          balance: initialBalanceIfNew,
          is_unlimited: isUnlimited,
          refill_count: 0,
          monthly_reset_date: new Date(Date.now() + PRICING.registration.durationMs),
          last_updated: new Date(),
        },
      },
      { upsert: true }
    );
    return;
  }

  const update: any = { $inc: { refill_count: 1 }, $set: { last_updated: new Date() } };
  if (isUnlimited) {
    update.$set.is_unlimited = true;
  } else {
    update.$inc.balance = quota;
  }
  await TokenBalance.findOneAndUpdate(baseFilter, update);
}

/**
 * Handle successful payment callback.
 * Returns a human-readable summary or throws.
 *
 * Idempotency (B7) dijamin dua lapis:
 *  1. pengecekan `transactions.order_id` sebelum menulis
 *  2. partial unique index `transactions.order_id` (filter: order_id terisi)
 */
export async function handlePaymentSuccess(
  order_id: string,
  gross_amount: number,
  userId: string,
  orderType: "registration" | "package",
  transaction_id: string,
  boosterDiscount: boolean = false,
  packageType?: "basic" | "pro" | "premium"
): Promise<string> {
  const userObjectId = toUserId(userId);
  console.log(
    "[handlePaymentSuccess] called with:",
    {
      userId,
      userObjectId: userObjectId?.toString(),
      orderType,
      gross_amount,
      order_id,
    }
  );

  // 1. Idempotency guard — jangan proses dua kali untuk order_id yang sama.
  const alreadyProcessed = await Transaction.findOne({ order_id });
  if (alreadyProcessed) {
    return `Payment ${order_id} already processed (transaction ${alreadyProcessed.reference_id})`;
  }

  // 2. Record transaction (dipakai juga sebagai kunci idempotency via order_id).
  await Transaction.create({
    user_id: userObjectId,
    type: orderType,
    amount: gross_amount,
    currency: "IDR",
    status: "completed",
    reference_id: transaction_id,
    order_id,
    description:
      orderType === "registration"
        ? `Registration fee${boosterDiscount ? " (Booster -10%)" : ""}`
        : `Package ${packageType} purchase${boosterDiscount ? " (Booster -10%)" : ""}`,
  });

  const tokenQuota = getTokenQuota({ orderType, packageType });

  if (orderType === "registration") {
    const user = await findAuthUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found in better-auth collection`);
    }

    // Mark registration active.
    await Registration.findOneAndUpdate(
      { user_id: userObjectId },
      {
        user_id: userObjectId,
        discord_id: user.id || user._id?.toString() || userId,
        username: user.name,
        email: user.email,
        registration_status: "active",
        registration_paid_at: new Date(),
        is_booster: boosterDiscount,
        plan: "basic",
        is_lifetime: false,
        updated_at: new Date(),
      },
      { upsert: true }
    );

    await Subscription.findOneAndUpdate(
      { user_id: userObjectId },
      {
        user_id: userObjectId,
        plan: "basic",
        status: "active",
        start_date: new Date(),
        end_date: new Date(Date.now() + PRICING.registration.durationMs),
        auto_renew: true,
        updated_at: new Date(),
      },
      { upsert: true }
    );

    // B6: saldo ditambah, bukan ditimpa.
    await creditTokenBalance(userObjectId, tokenQuota, PRICING.registration.tokenQuota);

    return `Registration activated for user ${userId}. Token balance: ${PRICING.registration.tokenQuota}`;
  }

  if (orderType === "package") {
    const user = await findAuthUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found in better-auth collection`);
    }

    const isPremium = packageType === "premium";
    const isPro = packageType === "pro";
    const pkg = packageType ? PRICING.packages[packageType] : null;

    if (!pkg) {
      throw new Error(`Unknown packageType: ${String(packageType)}`);
    }

    // B6: perpanjang dari akses yang sedang berjalan, bukan dari Date.now().
    const existingReg = await Registration.findOne({ user_id: userObjectId }).lean();
    const baseEnd =
      existingReg?.access_end_date && existingReg.access_end_date.getTime() > Date.now()
        ? existingReg.access_end_date
        : null;

    const accessDurationMs = pkg.durationMs;
    const eaDurationMs = 30 * 24 * 60 * 60 * 1000; // Free EA 1 bulan (Premium & Pro)

    const updateData: any = {
      user_id: userObjectId,
      discord_id: user.id || user._id?.toString() || userId,
      username: user.name,
      email: user.email,
      registration_status: "active",
      registration_paid_at: new Date(),
      is_booster: boosterDiscount,
      plan: packageType || "basic",
      is_lifetime: isPremium,
      updated_at: new Date(),
    };
    if (accessDurationMs) {
      updateData.access_end_date = baseEnd
        ? new Date(baseEnd.getTime() + accessDurationMs)
        : new Date(Date.now() + accessDurationMs);
    }
    if (isPremium || isPro) {
      const eaBase =
        existingReg?.ea_active_until && existingReg.ea_active_until.getTime() > Date.now()
          ? existingReg.ea_active_until
          : new Date();
      updateData.ea_active_until = new Date(eaBase.getTime() + eaDurationMs);
    }

    await Registration.findOneAndUpdate({ user_id: userObjectId }, updateData, {
      upsert: true,
    });

    await Subscription.findOneAndUpdate(
      { user_id: userObjectId },
      {
        user_id: userObjectId,
        plan: packageType || "basic",
        status: "active",
        start_date: new Date(),
        end_date: accessDurationMs
          ? updateData.access_end_date
          : existingReg?.end_date,
        auto_renew: false,
        updated_at: new Date(),
      },
      { upsert: true }
    );

    // B6: saldo ditambah; `is_unlimited` hanya berubah untuk premium.
    await creditTokenBalance(
      userObjectId,
      tokenQuota,
      tokenQuota ?? PRICING.packages.premium.tokenQuota ?? 0
    );

    return `Package ${packageType} activated for user ${userId}. Token balance: ${
      isPremium ? "unlimited" : tokenQuota
    }`;
  }

  throw new Error(`Unsupported order type: ${orderType}`);
}

/**
 * Full payment status for a user — called once on AI Trading page load.
 */
export async function getPaymentStatus(userId: string): Promise<{
  isRegistered: boolean;
  hasAccess: boolean;
  isBooster: boolean;
  plan?: string;
  accessEndDate?: string;
}> {
  if (userId === "anonymous") {
    return {
      isRegistered: false,
      hasAccess: false,
      isBooster: false,
    };
  }

  const key = toUserId(userId);
  const query: any = mongoose.isValidObjectId(userId)
    ? { $or: [{ user_id: key }, { user_id: userId }] }
    : { user_id: userId };

  const registration = await Registration.findOne(query);
  const isRegistered = registration?.registration_status === "active";
  const accessEndDate = registration?.access_end_date;
  const hasAccess = Boolean(
    isRegistered &&
      (registration?.is_lifetime === true ||
        (accessEndDate && accessEndDate.getTime() > Date.now()))
  );

  return {
    isRegistered,
    hasAccess,
    isBooster: registration?.is_booster ?? false,
    plan: registration?.plan,
    accessEndDate: accessEndDate?.toISOString(),
  };
}


