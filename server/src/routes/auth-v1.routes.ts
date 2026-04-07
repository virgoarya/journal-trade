import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { DiscordAPIService } from "../services/discord-api.service";
import { authMongoClient } from "../db/mongoose";
import { env } from "../config/env";
import { apiResponse } from "../utils/api-response";

const router = Router();

/**
 * GET /api/v1/auth/verify-guild
 * Verifies that the authenticated user is a member of the configured Discord guild.
 * Requires valid session ( Bearer token or cookie )
 *
 * Headers: Authorization: Bearer <sessionToken>  OR  cookies
 *
 * Returns:
 *   { success: true, data: { isMember: boolean, guildId: string } }
 */
router.get('/verify-guild', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return apiResponse.unauthorized(res, 'User tidak terautentikasi');
    }

    // Use authMongoClient directly instead of authInstance.api
    const db = authMongoClient.db(env.DATABASE_NAME);
    if (!db) {
      return apiResponse.error(res, 'Database tidak tersedia', 'DATABASE_ERROR', 500);
    }

    // Find the Discord OAuth account for this user
    // Support both String and ObjectId formats and common collection names
    const { ObjectId } = require('mongodb');
    let account = null;
    const collections = ['account', 'accounts'];

    for (const colName of collections) {
      const collection = db.collection(colName);
      
      // Try multiple query variations for ID format and provider field name
      const queryVariations = [
        { userId: userId, providerId: 'discord' },
        { userId: new ObjectId(userId), providerId: 'discord' },
        { userId: userId, provider: 'discord' },
        { userId: new ObjectId(userId), provider: 'discord' }
      ];

      for (const query of queryVariations) {
        try {
          account = await collection.findOne(query);
          if (account) break;
        } catch (e) {}
      }
      if (account) break;
    }

    if (!account) {
      return apiResponse.error(res, 'Sesi Discord tidak ditemukan. Silakan login ulang.', 'DISCORD_ACCOUNT_NOT_FOUND', 403);
    }

    // Support multiple field names for token and discord ID (Better Auth MongoDB adapter defaults)
    const accessToken = account.accessToken || account.access_token;
    const discordUserId = account.accountId || account.providerAccountId;

    if (!accessToken || !discordUserId) {
      return apiResponse.error(res, 'Sesi Discord tidak valid. Silakan login ulang.', 'DISCORD_TOKEN_MISSING', 403);
    }

    // Verify guild membership using Discord API
    const discordService = DiscordAPIService.getInstance();
    
    // Strategy: Fetch all user guilds and search for our target guildId
    const userGuilds = await discordService.getUserGuilds(accessToken);
    const isMember = userGuilds.some((guild: any) => guild.id === env.DISCORD_GUILD_ID);

    // Return membership status
    return apiResponse.success(res, {
      isMember,
      guildId: env.DISCORD_GUILD_ID,
    });

  } catch (error: any) {
    console.error('[GUILD_VERIFY] Error:', error);

    // Handle specific Discord API errors
    if (error.response?.status === 401) {
      return apiResponse.error(res, 'Sesi Discord tidak valid. Silakan login ulang.', 'DISCORD_TOKEN_INVALID', 403);
    }
    if (error.response?.status === 429) {
      return apiResponse.error(res, 'Terlalu banyak permintaan. Coba lagi dalam beberapa saat.', 'RATE_LIMIT_EXCEEDED', 429);
    }

    return apiResponse.error(res, 'Gagal memverifikasi guild membership', 'VERIFICATION_FAILED', 500);
  }
});

export default router;
