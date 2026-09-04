import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { connectDB } from "../db/mongoose";
import { verifyMidtransSignature, parseOrderId, handlePaymentSuccess } from "../services/payment.service";
import { Registration } from "../models/Registration";
import { TokenBalance } from "../models/TokenBalance";

async function runTest() {
  console.log("🔌 Connecting to MongoDB...");
  await connectDB();

  const testUserId = "650123456789abcdef012345"; // Mock ObjectId
  const orderId = `registration_${testUserId}_${Date.now()}`;
  const statusCode = "200";
  const grossAmount = "2000000.00";
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;

  // Generate valid signature
  const signatureKey = crypto
    .createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");

  const mockPayload = {
    transaction_status: "settlement",
    order_id: orderId,
    transaction_id: `trx_sandbox_${Date.now()}`,
    gross_amount: grossAmount,
    status_code: statusCode,
    signature_key: signatureKey,
  };

  console.log("🧪 Simulating Midtrans Webhook Callback...");
  console.log("Payload:", mockPayload);

  // 1. Verify Signature
  const isValid = verifyMidtransSignature(mockPayload);
  console.log("🔐 Signature Validated:", isValid);
  if (!isValid) {
    console.error("❌ Test failed: Signature mismatch!");
    process.exit(1);
  }

  // 2. Parse Order ID
  const ctx = parseOrderId(mockPayload.order_id);
  console.log("📦 Parsed Order Context:", ctx);
  if (!ctx) {
    console.error("❌ Test failed: Could not parse order_id!");
    process.exit(1);
  }

  // 3. Handle Payment Success (Update DB)
  const result = await handlePaymentSuccess(
    mockPayload.order_id,
    Number(mockPayload.gross_amount),
    ctx.userId,
    ctx.orderType,
    mockPayload.transaction_id,
    true // booster discount applied
  );
  console.log("💾 DB Update Result:", result);

  // 4. Verify in DB
  const reg = await Registration.findOne({ user_id: testUserId });
  const bal = await TokenBalance.findOne({ user_id: testUserId });
  console.log("🔍 Verified Registration in DB:", reg ? reg.registration_status : "Not found");
  console.log("🔍 Verified Token Balance in DB:", bal ? bal.balance : "Not found");

  console.log("✅ Callback Simulation PASSED!");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("🔥 Test script crashed:", err);
  process.exit(1);
});
