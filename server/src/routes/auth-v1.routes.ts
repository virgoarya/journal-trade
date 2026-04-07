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
      
      // Try 1: Search with userId as string
      account = await collection.findOne({
        userId: userId,
        provider: 'discord',
      });
      
      if (account) {
        console.log(`[GUILD_VERIFY] Found account in '${colName}' using String ID.`);
      } else if (typeof userId === 'string' && userId.length === 24) {
        // Try 2: Search with userId as ObjectId
        try {
          account = await collection.findOne({
            userId: new ObjectId(userId),
            provider: 'discord',
          });
          if (account) {
            console.log(`[GUILD_VERIFY] Found account in '${colName}' using ObjectId.`);
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
          console.log(`[GUILD_VERIFY] Found an account in '${colName}' but might not be 'discord' provider. Provider is: ${anyAccount.provider}`);
          account = anyAccount;
          break;
        }
      }
    }

    if (!account || !account.accessToken) {
      console.error(`[GUILD_VERIFY] Final check failed. accountFound: ${!!account}, tokenFound: ${!!account?.accessToken}`);
      return apiResponse.error(res, 'Sesi Discord tidak ditemukan. Silakan login ulang.', 'DISCORD_ACCOUNT_NOT_FOUND', 403);
    }

    // Extract Discord user ID from providerAccountId
    const discordUserId = account.providerAccountId;
    if (!discordUserId) {
      console.error(`[GUILD_VERIFY] providerAccountId missing for account:`, account._id || account.id);
      return apiResponse.error(res, 'Discord user ID tidak ditemukan', 'DISCORD_USER_ID_NOT_FOUND', 403);
    }

    console.log(`[GUILD_VERIFY] Verifying Discord user: ${discordUserId}`);

    // Verify guild membership using Discord API
    const discordService = DiscordAPIService.getInstance();
    
    // Strategy: Fetch all user guilds and search for our target guildId
    // This works even without a bot in the server
    const userGuilds = await discordService.getUserGuilds(account.accessToken);
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
