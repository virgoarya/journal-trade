import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { env } from "../config/env";
import { TradingAccount } from "../models/TradingAccount";
import { apiResponse } from "../utils/api-response";

const router = Router();
router.use(requireAuth);

router.get("/check-dev", async (req, res) => {
  try {
    const userEmail = req.user?.email as string | undefined;

    if (!userEmail || !env.DEV_WHITELIST_EMAILS) {
      return apiResponse.success(res, { isDev: false });
    }

    const whitelist = env.DEV_WHITELIST_EMAILS.split(",").map((e) =>
      e.trim().toLowerCase()
    );
    const isDev = whitelist.includes(userEmail.toLowerCase());

    return apiResponse.success(res, { isDev });
  } catch (error: any) {
    console.error("[BROKER_REG_CHECK] Error:", error);
    return apiResponse.error(res, "Gagal memeriksa status developer", "CHECK_ERROR", 500);
  }
});

router.get("/status", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return apiResponse.unauthorized(res, "User tidak terautentikasi");

    const account = await TradingAccount.findOne({ userId, isActive: true });
    if (!account) return apiResponse.notFound(res, "Akun tidak ditemukan");

    return apiResponse.success(res, {
      needsRegistration: !account.referralBroker && !account.referralVerified,
      referralBroker: account.referralBroker,
      referralEmail: account.referralEmail,
      referralVerified: account.referralVerified,
    });
  } catch (error: any) {
    console.error("[BROKER_REG_STATUS] Error:", error);
    return apiResponse.error(res, "Gagal memeriksa status", "CHECK_ERROR", 500);
  }
});

router.post("/save", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return apiResponse.unauthorized(res, "User tidak terautentikasi");

    const { referralBroker, referralEmail } = req.body;

    if (!referralBroker || !["exness", "valetax"].includes(referralBroker)) {
      return apiResponse.error(res, "Pilih broker yang valid (exness/valetax)", "VALIDATION_ERROR", 400);
    }
    if (!referralEmail || typeof referralEmail !== "string") {
      return apiResponse.error(res, "Email wajib diisi", "VALIDATION_ERROR", 400);
    }

    const account = await TradingAccount.findOneAndUpdate(
      { userId, isActive: true },
      {
        $set: {
          referralBroker,
          referralEmail: referralEmail.trim().toLowerCase(),
          referralVerified: true,
        },
      },
      { returnDocument: "after" }
    );

    if (!account) return apiResponse.notFound(res, "Akun aktif tidak ditemukan");

    return apiResponse.success(res, {
      referralBroker: account.referralBroker,
      referralEmail: account.referralEmail,
      referralVerified: account.referralVerified,
    });
  } catch (error: any) {
    console.error("[BROKER_REG_SAVE] Error:", error);
    return apiResponse.error(res, "Gagal menyimpan data referral", "SAVE_ERROR", 500);
  }
});

export default router;
