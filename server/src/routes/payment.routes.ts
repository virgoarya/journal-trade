import { Router } from "express";
import { z } from "zod";
import {
  createPaymentToken,
  checkStatus,
  midtransCallback,
  getPaymentStatusHandler,
} from "../controllers/midtrans.controller";
import { validate, validateBody } from "../middleware/validate";

const router = Router();

// --- Zod Schemas (single source of truth) ---
const createTokenSchema = z.object({
  userId: z.string().min(1),
  amountIDR: z.number().positive(),
  isBooster: z.boolean().optional(),
  orderType: z.enum(["registration", "token_topup"]),
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

/** POST /api/payment/callback — webhook Midtrans */
router.post("/callback", midtransCallback);

/** GET /api/payment/status-for-user/:userId — gate AI Trading page */
router.get(
  "/status-for-user/:userId",
  validate({ params: userIdParamSchema }),
  getPaymentStatusHandler
);

/** GET /api/payment/token-balance/:userId — compatibility route */
router.get(
  "/token-balance/:userId",
  validate({ params: userIdParamSchema }),
  getPaymentStatusHandler
);

export default router;
