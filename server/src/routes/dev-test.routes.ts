import { Router } from "express";
import { env } from "../config/env";
import crypto from "crypto";

// ── DEV TEST SESSION (ONLY in development) ──────────────────────────────────
// Membuat user + session test untuk integration testing.
// Aman: kode ini tidak bisa diakses di produksi karena guard NODE_ENV.

const router = Router();

router.post("/test-session", async (req, res) => {
  if (env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "not found" });
  }

  try {
    const mongoose = await import("../db/mongoose");
    const db = mongoose.authMongoClient.db(env.DATABASE_NAME);

    const USER_ID = "test_user_integration";
    const now = new Date();

    const existing = await db.collection("user").findOne({ id: USER_ID });
    if (!existing) {
      await db.collection("user").insertOne({
        id: USER_ID,
        name: "Integration Test",
        email: "integration.test@journaltrade.local",
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.collection("session").deleteMany({ userId: USER_ID });

    const token = crypto.randomBytes(32).toString("base64url");
    // better-auth stores the RAW token in DB and matches the raw cookie token.
    await db.collection("session").insertOne({
      id: crypto.randomBytes(16).toString("hex"),
      token,
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip || "::1",
      userAgent: "integration-test",
      createdAt: now,
      updatedAt: now,
    });

    return res.status(200).json({
      cookieName: "better-auth.session_token",
      cookieValue: token,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;