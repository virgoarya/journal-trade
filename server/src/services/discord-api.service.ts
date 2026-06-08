import axios from 'axios';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface CacheEntry {
  data: any[];
  expiresAt: number;
}

export class DiscordAPIService {
  private static instance: DiscordAPIService;
  private guildCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 30_000; // 30 seconds
  private readonly RATE_LIMIT_RETRY_MS = 1_500; // 1.5s

  static getInstance(): DiscordAPIService {
    if (!DiscordAPIService.instance) {
      DiscordAPIService.instance = new DiscordAPIService();
    }
    return DiscordAPIService.instance;
  }

  /**
   * Get all guilds the user is a member of
   * @param accessToken - Discord OAuth access token
   * @returns Array of partial guild objects
   */
  async getUserGuilds(accessToken: string): Promise<any[]> {
    // Check cache first
    const cached = this.guildCache.get(accessToken);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      console.log(`[DISCORD_API] Returning cached guilds (${cached.data.length})`);
      return cached.data;
    }

    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        console.log(`[DISCORD_API] Fetching user guilds list... (attempt ${attempt + 1})`);
        const response = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        
        const guilds = response.data;
        console.log(`[DISCORD_API] Successfully fetched ${guilds.length} guilds.`);
        
        // Cache the result
        this.guildCache.set(accessToken, {
          data: guilds,
          expiresAt: now + this.CACHE_TTL_MS,
        });

        return guilds;
      } catch (error: any) {
        const status = error.response?.status;
        const retryAfter = error.response?.headers?.['retry-after'];

        if (status === 429 && attempt < maxRetries) {
          const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : this.RATE_LIMIT_RETRY_MS;
          console.warn(`[DISCORD_API] Rate limited. Waiting ${waitMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          attempt++;
          continue;
        }

        console.error(
          `[DISCORD_API] Error fetching user guilds:`,
          error.response?.data || error.message
        );
        throw error;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('Failed to fetch guilds after retries');
  }

  /**
   * Check if a Discord user is a member of a specific guild
   * @param accessToken - Discord OAuth access token
   * @param guildId - Discord guild (server) ID
   * @param userId - Discord user ID (snowflake)
   * @returns true if user is a member, false otherwise
   */
  async checkGuildMembership(
    accessToken: string,
    guildId: string,
    userId: string
  ): Promise<boolean> {
    try {
      console.log(`[DISCORD_API] Verifying membership for user ${userId} in guild ${guildId}`);
      const response = await axios.get(
        `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      const isMember = response.status === 200;
      console.log(`[DISCORD_API] User ${userId} membership status: ${isMember}`);
      return isMember;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`[DISCORD_API] User ${userId} is NOT a member of guild ${guildId} (Direct Check)`);
        return false;
      }
      
      if (error.response?.status === 403) {
        console.error(`[DISCORD_API] Forbidden (Direct Check): Token may be missing 'guilds.members.read' scope or Bot is not in the server.`);
      }
      
      console.error(`[DISCORD_API] error checking membership directly:`, error.response?.data || error.message);
      return false; // Silently fail and let the main logic handle it
    }
  }
}

