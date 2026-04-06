import axios from 'axios';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export class DiscordAPIService {
  private static instance: DiscordAPIService;

  static getInstance(): DiscordAPIService {
    if (!DiscordAPIService.instance) {
      DiscordAPIService.instance = new DiscordAPIService();
    }
    return DiscordAPIService.instance;
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
        console.warn(`[DISCORD_API] User ${userId} is NOT a member of guild ${guildId}`);
        return false;
      }
      
      if (error.response?.status === 403) {
        console.error(`[DISCORD_API] Forbidden: Token may be missing 'guilds.members.read' scope or Bot is not in the server.`);
      }
      
      console.error(`[DISCORD_API] error checking membership:`, error.response?.data || error.message);
      throw error;
    }
  }
}
