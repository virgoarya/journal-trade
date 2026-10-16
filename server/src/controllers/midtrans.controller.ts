import { Request, Response } from "express";
import { z } from "zod";
import {
  createSnapToken,
  getTransactionStatus,
} from "../services/midtrans.service";
import {
  verifyMidtransSignature,
  parseOrderId,
  handlePaymentSuccess,
  hasInsufficientToken,
  getPaymentStatus,
} from "../services/payment.service";
import { Transaction } from "../models/Transaction";

/** Zod schema untuk body createPaymentToken */
const createTokenSchema = z.object({
  userId: z.string().min(1),
  amountIDR: z.number().positive(),
  isBooster: z.boolean().optional(),
  orderType: z.enum(["registration", "token_topup", "package"]),
  packageType: z.enum(["basic", "pro", "premium"]).optional(),
});

/** POST /api/payment/token — buat Snap Token */
export async function createPaymentToken(req: Request, res: Response) {
  try {
    // validated & sanitized oleh middleware Zod (validateBody(createTokenSchema))
    const { userId, amountIDR, isBooster, orderType, packageType } = req.body;

    if (Array.isArray(userId)) {
      return res.status(400).json({ error: "userId must be a single string" });
    }

    // ponytail: prefix kept "reg"/"top"/"pkg" for parseOrderId compat
    const typePrefix =
      orderType === "registration" ? "reg" :
      orderType === "token_topup" ? "top" :
      "pkg";
    const order_id =
      orderType === "package" && packageType
        ? `pkg_${userId}_${packageType}_${Date.now()}`
        : `${typePrefix}_${userId}_${Date.now()}`;

    const token = await createSnapToken({
      userId,
      amountIDR,
      isBooster,
      discount: isBooster ? 0.1 : 0,
      orderType,
      packageType: orderType === "package" ? packageType : undefined,
      orderId: order_id,
    });

    res.json({ token, orderId: order_id });
  } catch (err: any) {
    console.error("[Midtrans] createSnapToken error:", err.message);
    res.status(500).json({ error: "Failed to create payment token" });
  }
}

/** GET /api/payment/status/:orderId — cek status transaksi */
export async function checkStatus(req: Request, res: Response) {
  try {
    let { orderId } = req.params;
    if (Array.isArray(orderId)) {
      orderId = orderId[0];
    }
    if (typeof orderId !== "string" || orderId.length === 0) {
      return res.status(400).json({ error: "Invalid orderId parameter" });
    }
    const status = await getTransactionStatus(orderId);
    res.json({ orderId, status });
  } catch (err: any) {
    console.error("[Midtrans] getTransactionStatus error:", err.message);
    res.status(500).json({ error: "Failed to get status" });
  }
}

/** POST /api/payment/confirm — finalisasi pembayaran dari client (fallback webhook) */
export async function confirmPayment(req: Request, res: Response) {
  try {
    const { orderId } = req.body;
    if (!orderId || typeof orderId !== "string") {
      return res.status(400).json({ error: "orderId is required" });
    }

    // 1. Cek status transaksi ke Midtrans API
    const status = await getTransactionStatus(orderId);
    const transactionStatus = status.transaction_status;
    const successStatuses = ["capture", "settlement"];

    if (!successStatuses.includes(transactionStatus)) {
      return res.status(400).json({
        error: `Payment not completed. Status: ${transactionStatus}`,
      });
    }

    // 2. Parse order_id untuk dapat userId, orderType, packageType
    const ctx = parseOrderId(orderId);
    if (!ctx) {
      return res.status(400).json({ error: "Invalid order_id format" });
    }

    // 3. Idempotency check — skip if already processed
    const existingTxn = await Transaction.findOne({
      reference_id: status.transaction_id,
    });
    if (existingTxn && existingTxn.status === "completed") {
      return res.json({
        message: "Payment already processed",
        orderId,
        userId: ctx.userId,
      });
    }

    // 4. Finalize payment
    console.log("[Midtrans] confirmPayment calling handlePaymentSuccess:", {
      orderId,
      gross_amount: status.gross_amount,
      userId: ctx.userId,
      orderType: ctx.orderType,
      transaction_id: status.transaction_id,
      packageType: ctx.packageType,
    });
    const result = await handlePaymentSuccess(
      orderId,
      Number(status.gross_amount),
      ctx.userId,
      ctx.orderType,
      status.transaction_id,
      false, // boosterDiscount
      ctx.packageType
    );
    console.log("[Midtrans] confirmPayment result:", result);

    return res.json({ message: result, orderId, userId: ctx.userId });
  } catch (err: any) {
    console.error("[Midtrans] confirmPayment error:", err.message);
    console.error("[Midtrans] confirmPayment stack:", err.stack);
    res.status(500).json({ error: "Failed to confirm payment", detail: err.message });
  }
}

/** POST /api/payment/callback — webhook Midtrans (PRODUCTION) */
export async function midtransCallback(req: Request, res: Response) {
  const {
    transaction_status,
    order_id,
    transaction_id,
    gross_amount,
    signature_key,
    status_code,
  } = req.body;

  console.log("[Midtrans] Callback received:", {
    transaction_status,
    order_id,
    transaction_id,
    gross_amount,
    status_code,
  });

  // 1. Verify signature
  const isVerified = verifyMidtransSignature({
    order_id,
    status_code,
    gross_amount,
    signature_key,
  });
  if (!isVerified) {
    console.error("[Midtrans] Invalid signature!");
    return res.status(403).send("Invalid signature");
  }

  // 2. Only process successful payments
  const successStatuses = ["capture", "settlement"];
  if (!successStatuses.includes(transaction_status)) {
    console.log(`[Midtrans] Ignoring status: ${transaction_status}`);
    return res.status(200).send("OK (non-success status ignored)");
  }

  // 3. Parse order_id
  const ctx = parseOrderId(order_id);
  if (!ctx) {
    console.error("[Midtrans] Invalid order_id format:", order_id);
    return res.status(400).send("Invalid order_id");
  }

  try {
    const result = await handlePaymentSuccess(
      order_id,
      Number(gross_amount),
      ctx.userId,
      ctx.orderType,
      transaction_id,
      ctx.orderType === "registration",
      ctx.packageType
    );
    console.log("[Midtrans] Payment processed:", result);
    return res.status(200).send("OK");
  } catch (e: any) {
    console.error("[Midtrans] DB update failed:", e.message);
    return res.status(500).send("DB error");
  }
}

/** GET /api/payment/status/:userId — full payment status (gate AI Trading page) */
export async function getPaymentStatusHandler(req: Request, res: Response) {
  try {
    let { userId } = req.params;
    if (Array.isArray(userId)) userId = userId[0];
    if (typeof userId !== "string") {
      return res.status(400).json({ error: "Invalid userId" });
    }
    const status = await getPaymentStatus(userId);
    res.json({ userId, ...status });
  } catch (err: any) {
    console.error("[Midtrans] getPaymentStatus error:", err.message);
    res.status(500).json({ error: "Failed to get payment status" });
  }
}
