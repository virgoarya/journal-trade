import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { authMongoClient } from "../db/mongoose";
import { env } from "../config/env";
import { apiResponse } from "../utils/api-response";
import { ObjectId } from "mongodb";

const router = Router();

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const data = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: data,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Token refresh failed: HTTP ${res.status}`);
  }
  const tokens = await res.json() as { access_token: string };
  return tokens.access_token;
}

async function fetchAvatarUrl(accessToken: string): Promise<string | null> {
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord API failed: HTTP ${res.status}`);
  const user = (await res.json()) as { id: string; avatar?: string };
  if (!user.avatar) return null;
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
}

router.post("/sync-avatar", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return apiResponse.unauthorized(res, "User tidak terautentikasi");

    const db = authMongoClient.db(env.DATABASE_NAME);
    const account = await db.collection("account").findOne({
      userId: new ObjectId(userId),
      providerId: "discord",
    });

    if (!account) {
      return apiResponse.error(res, "Akun Discord tidak ditemukan", "DISCORD_ACCOUNT_NOT_FOUND", 404);
    }

    let accessToken = account.accessToken;
    let avatarUrl: string | null = null;

    try {
      avatarUrl = await fetchAvatarUrl(accessToken);
    } catch (err: any) {
      console.log(`[SYNC_AVATAR] Token expired for user ${userId}, attempting refresh...`);
      // Token expired — try refresh
      if (!account.refreshToken) {
        return apiResponse.error(res, "Token expired dan tidak ada refresh token. Silakan login ulang via Discord.", "TOKEN_EXPIRED", 401);
      }
      try {
        accessToken = await refreshAccessToken(account.refreshToken);
        await db.collection("account").updateOne(
          { _id: account._id },
          { $set: { accessToken, updatedAt: new Date() } },
        );
        avatarUrl = await fetchAvatarUrl(accessToken);
      } catch (refreshErr: any) {
        console.error(`[SYNC_AVATAR] Refresh failed: ${refreshErr.message}`);
        return apiResponse.error(res, "Gagal memperbarui token Discord. Silakan login ulang.", "REFRESH_FAILED", 401);
      }
    }

    await db.collection("user").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { image: avatarUrl, updatedAt: new Date() } },
    );

    return apiResponse.success(res, { image: avatarUrl });
  } catch (error: any) {
    console.error("[SYNC_AVATAR] Error:", error);
    return apiResponse.error(res, "Gagal sync avatar", "SYNC_FAILED", 500);
  }
});

export default router;
