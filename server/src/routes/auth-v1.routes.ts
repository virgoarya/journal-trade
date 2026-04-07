import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { DiscordAPIService } from "../services/discord-api.service";
import { authInstance } from "../auth-context";
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

    // Get database connection from authInstance
    const db = authInstance.api.getDatabase();
    if (!db) {
      return apiResponse.error(res, 'Database tidak tersedia', 'DATABASE_ERROR', 500);
    }

    // Find the Discord OAuth account for this user
    // Better Auth stores accounts in 'accounts' collection
    const accountsCollection = db.collection('accounts');
    const account = await accountsCollection.findOne({
      userId: userId,
      provider: 'discord',
    });

    if (!account || !account.accessToken) {
      return apiResponse.error(res, 'Discord account tidak ditemukan. Silakan login ulang dengan Discord.', 'DISCORD_ACCOUNT_NOT_FOUND', 403);
    }

    // Extract Discord user ID from providerAccountId
    const discordUserId = account.providerAccountId;
    if (!discordUserId) {
      return apiResponse.error(res, 'Discord user ID tidak ditemukan', 'DISCORD_USER_ID_NOT_FOUND', 403);
    }

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
