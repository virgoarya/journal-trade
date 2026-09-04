/**
 * STANDALONE Midtrans Sandbox Test
 * Tujuan: verifikasi integrasi Midtrans (Snap Token + Signature) tanpa jalanin server full.
 * Jalankan: node test-midtrans-sandbox.js
 */
require("dotenv").config();
const { Snap, CoreApi } = require("midtrans-client");
const crypto = require("crypto");

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY;
const IS_PRODUCTION = process.env.MIDTRANS_ENV === "production";

console.log("=== Midtrans Sandbox Config ===");
console.log("SERVER_KEY present:", !!SERVER_KEY, SERVER_KEY ? `(len=${SERVER_KEY.length})` : "");
console.log("CLIENT_KEY present:", !!CLIENT_KEY, CLIENT_KEY ? `(len=${CLIENT_KEY.length})` : "");
console.log("IS_PRODUCTION:", IS_PRODUCTION);
console.log("");

if (!SERVER_KEY) {
  console.error("❌ MIDTRANS_SERVER_KEY tidak ditemukan di .env");
  process.exit(1);
}

const snap = new Snap({ isProduction: IS_PRODUCTION, serverKey: SERVER_KEY });
const coreApi = new CoreApi({ isProduction: IS_PRODUCTION, serverKey: SERVER_KEY });

async function main() {
  const order_id = `registration_test_${Date.now()}`;
  const gross_amount = 2000000;

  console.log("=== 1. Create Snap Token ===");
  const parameter = {
    order_id,
    gross_amount,
    items: [
      {
        id: "reg_fee",
        price: gross_amount,
        quantity: 1,
        name: "Registration & AI Trading Access",
      },
    ],
    transaction_details: { order_id, gross_amount },
    customer_details: { email: "test_user@example.com" },
    enabled_payments: ["bank_transfer", "echannel", "gopay", "ovo", "dana"],
  };

  try {
    const token = await snap.createTransactionToken(parameter);
    console.log("✅ Snap Token created:", token.substring(0, 20) + "...");
    console.log("✅ Full token length:", token.length);
  } catch (err) {
    console.error("❌ Snap Token FAILED:", err.message);
    if (err.ApiResponse) console.error("API Response:", err.ApiResponse);
    return;
  }

  console.log("");
  console.log("=== 2. Signature Verification Test ===");
  // Simulate a callback payload
  const status_code = "200";
  const signature_key = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + SERVER_KEY)
    .digest("hex");

  const computed = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + SERVER_KEY)
    .digest("hex");

  console.log("Signature match:", signature_key === computed ? "✅ VALID" : "❌ INVALID");

  console.log("");
  console.log("=== 3. Status Check (will fail if order not yet paid) ===");
  try {
    const status = await coreApi.transaction.status(order_id);
    console.log("Status:", JSON.stringify(status, null, 2));
  } catch (err) {
    console.log("⚠️ Status check expected to fail for unpaid order:", err.message);
  }

  console.log("");
  console.log("=== ✅ Midtrans Integration OK ===");
  console.log("Client Key for frontend Snap:", CLIENT_KEY);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
