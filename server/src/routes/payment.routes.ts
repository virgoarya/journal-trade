import { Router } from "express";
import { z } from "zod";
import {
  createPaymentToken,
  checkStatus,
  confirmPayment,
  midtransCallback,
  getPaymentStatusHandler,
  getPricingCatalogHandler,
} from "../controllers/midtrans.controller";
import { validate, validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";

const router = Router();

// --- Zod Schemas (single source of truth) ---
const createTokenSchema = z.object({
  userId: z.string().min(1),
  amountIDR: z.number().positive(),
  isBooster: z.boolean().optional(),
  orderType: z.enum(["registration", "package"]),
  packageType: z.enum(["basic", "pro", "premium"]).optional(),
});

const orderIdParamSchema = z.object({
  orderId: z.string().min(1),
});

const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

/** POST /api/payment/token — buat Snap Token */
router.post("/token", validateBody(createTokenSchema), createPaymentToken);

/** GET /api/payment/status/:orderId — cek status transaksi */
router.get(
  "/status/:orderId",
  validate({ params: orderIdParamSchema }),
  checkStatus
);

/** POST /api/payment/confirm — finalisasi pembayaran dari client (fallback webhook) */
router.post("/confirm", requireAuth, confirmPayment);

/** POST /api/payment/callback — webhook Midtrans */
router.post("/callback", midtransCallback);

/** GET /api/payment/status-for-user/:userId — gate AI Trading page */
router.get(
  "/status-for-user/:userId",
  validate({ params: userIdParamSchema }),
  getPaymentStatusHandler
);

/** GET /api/payment/prices — price catalog for frontend display (public, no auth) */
router.get("/prices", getPricingCatalogHandler);

/** GET /api/payment/token-balance/:userId — compatibility route */
// Token balance route removed: access is package-based.

export default router;
