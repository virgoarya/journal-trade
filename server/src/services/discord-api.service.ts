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
      const response = await axios.get(
        `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return response.status === 200;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false; // User bukan member guild
      }
      throw error; // Error lain (rate limit, network, etc)
    }
  }
}
