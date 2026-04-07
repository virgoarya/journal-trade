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
    const { ObjectId } = require('mongodb');
    
    let account = null;
    const collections = ['account', 'accounts'];
    
    console.log(`[GUILD_VERIFY] Searching account for userId: ${userId}`);

    // DEBUG: List collections to be absolutely sure
    const allCols = await db.listCollections().toArray();
    console.log(`[GUILD_VERIFY] Available collections: ${allCols.map(c => c.name).join(', ')}`);

    for (const colName of collections) {
      const collection = db.collection(colName);
      const totalDocs = await collection.countDocuments();
      console.log(`[GUILD_VERIFY] Collection '${colName}' has ${totalDocs} documents.`);
      
      // Try with different field names: provider/providerId and accountId/providerAccountId
      const queryVariations = [
        { userId: userId, provider: 'discord' },
        { userId: userId, providerId: 'discord' },
        { userId: new ObjectId(userId), provider: 'discord' },
        { userId: new ObjectId(userId), providerId: 'discord' }
      ];

      for (const query of queryVariations) {
        try {
          account = await collection.findOne(query);
          if (account) {
            console.log(`[GUILD_VERIFY] Found account in '${colName}' using query: ${JSON.stringify(query)}`);
            break;
          }
        } catch (e) {}
      }
      
      if (account) break;
    }

    if (!account) {
      console.error(`[GUILD_VERIFY] SEARCH FAILED. Trying to find ANY account for userId: ${userId}`);
      for (const colName of collections) {
        const anyAccount = await db.collection(colName).findOne({
          $or: [{ userId: userId }, { userId: new ObjectId(userId) }]
        });
        if (anyAccount) {
          console.log(`[GUILD_VERIFY] DEBUG: Found account structure keys: ${Object.keys(anyAccount).join(', ')}`);
          console.log(`[GUILD_VERIFY] DEBUG: providerId: ${anyAccount.providerId}, provider: ${anyAccount.provider}`);
          account = anyAccount;
          break;
        }
      }
    }

    if (!account) {
      return apiResponse.error(res, 'Sesi Discord tidak ditemukan (Account missing). Silakan login ulang.', 'DISCORD_ACCOUNT_NOT_FOUND', 403);
    }

    // Try multiple field names for token and discord ID
    const accessToken = account.accessToken || account.access_token;
    const discordUserId = account.accountId || account.providerAccountId;

    if (!accessToken) {
      console.error(`[GUILD_VERIFY] Access token missing. Available keys:`, Object.keys(account).join(', '));
      return apiResponse.error(res, 'Sesi Discord kedaluwarsa. Silakan login ulang.', 'DISCORD_TOKEN_MISSING', 403);
    }

    if (!discordUserId) {
      console.error(`[GUILD_VERIFY] Discord User ID missing. Available keys:`, Object.keys(account).join(', '));
      return apiResponse.error(res, 'ID Discord tidak ditemukan di akun.', 'DISCORD_USER_ID_NOT_FOUND', 403);
    }

    console.log(`[GUILD_VERIFY] Verifying Discord user: ${discordUserId}`);

    // Verify guild membership using Discord API
    const discordService = DiscordAPIService.getInstance();
    
    // Strategy: Fetch all user guilds and search for our target guildId
    const userGuilds = await discordService.getUserGuilds(accessToken);
    const isMember = userGuilds.some((guild: any) => guild.id === env.DISCORD_GUILD_ID);

    if (!isMember) {
      console.warn(`[GUILD_VERIFY] User ${discordUserId} not found in guild ${env.DISCORD_GUILD_ID} list.`);
    }

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
