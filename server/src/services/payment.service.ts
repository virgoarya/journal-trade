import crypto from "crypto";
import mongoose from "mongoose";
import { authMongoClient } from "../db/mongoose";
import { env } from "../config/env";
import { Registration } from "../models/Registration";
import { Subscription } from "../models/Subscription";
import { TokenBalance } from "../models/TokenBalance";
import { Transaction } from "../models/Transaction";

/**
 * Midtrans signature verification.
 * Hash = sha512(order_id + status_code + gross_amount + serverKey)
 */
export function verifyMidtransSignature(payload: any): boolean {
  const { order_id, status_code, gross_amount, signature_key } = payload;
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const computed = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + serverKey)
    .digest("hex");
  return computed === signature_key;
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

interface PaymentContext {
  userId: string;
  orderType: "registration" | "token_topup" | "package";
  packageType?: "basic" | "pro" | "premium";
}

/** Extract userId + orderType from Midtrans order_id (format: `${prefix}_${userId}_${timestamp}` or `${prefix}_${userId}_${packageType}_${timestamp}`) */
export function parseOrderId(order_id: string): PaymentContext | null {
  let orderType: "registration" | "token_topup" | "package";
  let rest: string;

  if (order_id.startsWith("token_topup_")) {
    orderType = "token_topup";
    rest = order_id.substring("token_topup_".length);
  } else if (order_id.startsWith("registration_")) {
    orderType = "registration";
    rest = order_id.substring("registration_".length);
  } else if (order_id.startsWith("reg_")) {
    orderType = "registration";
    rest = order_id.substring("reg_".length);
  } else if (order_id.startsWith("pkg_")) {
    orderType = "package";
    rest = order_id.substring("pkg_".length);
  } else {
    return null;
  }

  const parts = rest.split("_");
  if (parts.length < 2) return null;

  const timestamp = parts.pop()!;
  const lastPart = parts[parts.length - 1];

  let packageType: "basic" | "pro" | "premium" | undefined;
  if (lastPart === "basic" || lastPart === "pro" || lastPart === "premium") {
    packageType = parts.pop()! as "basic" | "pro" | "premium";
  }

  const userId = parts.join("_");
  if (!userId) return null;

  return { userId, orderType, packageType };
}

/**
 * Handle successful payment callback.
 * Returns a human-readable summary or throws.
 */
export async function handlePaymentSuccess(
  order_id: string,
  gross_amount: number,
  userId: string,
  orderType: "registration" | "token_topup" | "package",
  transaction_id: string,
  boosterDiscount: boolean = false,
  packageType?: "basic" | "pro" | "premium"
): Promise<string> {
  // Force ObjectId for consistency
  const userObjectId = toUserId(userId);
  console.log("[handlePaymentSuccess] called with:", { userId, userObjectId: userObjectId?.toString(), orderType, gross_amount, order_id });

  // 1. Record transaction
  await Transaction.create({
    user_id: userObjectId,
    type: orderType,
    amount: gross_amount,
    currency: "IDR",
    status: "completed",
    reference_id: transaction_id,
    description:
      orderType === "registration"
        ? `Registration fee${boosterDiscount ? " (Booster -10%)" : ""}`
        : orderType === "package"
        ? `Package ${packageType} purchase`
        : "Token topup",
  });

  if (orderType === "registration") {
    // 2a. Get user data from better-auth collection
    const db = mongoose.connection.db!;
    const user = await db.collection("user").findOne({
      $or: [
        { _id: userId },
        { _id: userObjectId },
        { id: userId },
      ],
    });
    if (!user) {
      throw new Error(`User ${userId} not found in better-auth collection`);
    }

    // 2b. Mark registration active
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
        plan: "basic", // default legacy
        is_lifetime: false,
        updated_at: new Date(),
      },
      { upsert: true }
    );

    // 2c. Create initial subscription (recurring token)
    await Subscription.findOneAndUpdate(
      { user_id: userObjectId },
      {
        user_id: userObjectId,
        plan: "basic",
        status: "active",
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        auto_renew: true,
        updated_at: new Date(),
      },
      { upsert: true }
    );

    // 2d. Initialize token balance
    const initialTokens = 1000;
    await TokenBalance.findOneAndUpdate(
      { user_id: userObjectId },
      {
        user_id: userObjectId,
        balance: initialTokens,
        last_updated: new Date(),
        monthly_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      { upsert: true }
    );

    return `Registration activated for user ${userId}. Token balance: ${initialTokens}`;
  } else if (orderType === "package") {
    // 2a. Get user data from better-auth collection
    const db = mongoose.connection.db!;
    const user = await db.collection("user").findOne({
      $or: [
        { _id: userId },
        { _id: userObjectId },
        { id: userId },
      ],
    });
    if (!user) {
      throw new Error(`User ${userId} not found in better-auth collection`);
    }

    // 2b. Determine package properties
    const isPremium = packageType === "premium";
    const isPro = packageType === "pro";
    const accessDurationMs = isPremium
      ? undefined // lifetime
      : isPro
      ? 180 * 24 * 60 * 60 * 1000 // 6 months
      : 90 * 24 * 60 * 60 * 1000; // 3 months (basic)
    const initialTokens = isPremium ? 99999999 : 300000;
    const eaDurationMs = 30 * 24 * 60 * 60 * 1000; // Free EA 1 bulan (Premium & Pro)

    // 2c. Upsert Registration
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
      updateData.access_end_date = new Date(Date.now() + accessDurationMs);
    }
    if (isPremium || isPro) {
      updateData.ea_active_until = new Date(Date.now() + eaDurationMs);
    }
    await Registration.findOneAndUpdate({ user_id: userObjectId }, updateData, {
      upsert: true,
    });

    // 2d. Upsert Subscription
    await Subscription.findOneAndUpdate(
      { user_id: userObjectId },
      {
        user_id: userObjectId,
        plan: packageType || "basic",
        status: "active",
        start_date: new Date(),
        end_date: accessDurationMs ? new Date(Date.now() + accessDurationMs) : undefined,
        auto_renew: false, // Manual perpanjang
        updated_at: new Date(),
      },
      { upsert: true }
    );

    // 2e. Initialize token balance
    await TokenBalance.findOneAndUpdate(
      { user_id: userObjectId },
      {
        user_id: userObjectId,
        balance: initialTokens,
        is_unlimited: isPremium,
        refill_count: 0,
        last_updated: new Date(),
      },
      { upsert: true }
    );

    return `Package ${packageType} activated for user ${userId}. Token balance: ${
      isPremium ? "unlimited" : initialTokens
    }`;
  } else {
    // 2e. Topup token
    const tokensToAdd = Math.floor(gross_amount / 500); // Rp 500 per token (Rp 50.000 = 100 token)
    await TokenBalance.findOneAndUpdate(
      { user_id: userObjectId },
      {
        user_id: userObjectId,
        $inc: { balance: tokensToAdd, refill_count: 1 },
        last_updated: new Date(),
      },
      { upsert: true }
    );

    return `Token topup successful: +${tokensToAdd} tokens for user ${userId}`;
  }
}

/**
 * Full payment status for a user — called once on AI Trading page load.
 */
export async function getPaymentStatus(userId: string): Promise<{
  isRegistered: boolean;
  tokenBalance: number;
  hasInsufficientToken: boolean;
  isBooster: boolean;
  plan?: string;
  accessEndDate?: string;
  isUnlimited?: boolean;
}> {
  // Handle anonymous user
  if (userId === "anonymous") {
    return {
      isRegistered: false,
      tokenBalance: 0,
      hasInsufficientToken: true,
      isBooster: false,
    };
  }

  // Robust query — match both ObjectId (new) and string (legacy) storage
  const key = toUserId(userId);
  const query: any = mongoose.isValidObjectId(userId)
    ? { $or: [{ user_id: key }, { user_id: userId }] }
    : { user_id: userId };

  const [registration, tokenBalance] = await Promise.all([
    Registration.findOne(query),
    TokenBalance.findOne(query),
  ]);

  const isRegistered = registration?.registration_status === "active";
  const balance = tokenBalance?.balance ?? 0;

  return {
    isRegistered,
    tokenBalance: balance,
    hasInsufficientToken: balance < 1,
    isBooster: registration?.is_booster ?? false,
    plan: registration?.plan,
    accessEndDate: registration?.access_end_date?.toISOString(),
    isUnlimited: tokenBalance?.is_unlimited ?? false,
  };
}

/**
 * Auto-block check: returns true if user has insufficient token.
 */
export async function hasInsufficientToken(
  userId: string,
  requiredTokens: number = 1
): Promise<boolean> {
  const balance = await TokenBalance.findOne({ user_id: toUserId(userId) });
  if (!balance) return true;
  return balance.balance < requiredTokens;
}
