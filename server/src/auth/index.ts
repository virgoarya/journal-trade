import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { authMongoClient } from "../db/mongoose";
import { env } from "../config/env";
import { ObjectId } from "mongodb";

async function syncDiscordAvatar(account: { providerId?: string; accessToken?: string | null; userId?: string }): Promise<void> {
  if (account.providerId !== "discord" || !account.accessToken || !account.userId) return;

  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    if (!res.ok) return;

    const discordUser = await res.json() as { id: string; avatar?: string | null };
    const image = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${discordUser.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
      : null;

    await authMongoClient.db(env.DATABASE_NAME).collection("user").updateOne(
      { _id: new ObjectId(account.userId) },
      { $set: { image, updatedAt: new Date() } },
    );
  } catch (error) {
    console.warn("[AUTH] Failed to refresh Discord avatar:", error);
  }
}

// Factory: create auth instance after DB is connected
export const createAuth = () => {
  const db = authMongoClient.db(env.DATABASE_NAME);

  const auth = betterAuth({
    database: mongodbAdapter(db, {
      client: authMongoClient,
      debugLogs: false,
      transaction: false, // Atlas free tier does not support transactions
    }),
    debug: false,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:5000",
      "http://localhost:3000",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:3000",
      // Allow Cloudflare quick tunnels and custom tunnels
      // Allow local LAN IPs (e.g. for accessing from phone on same WiFi)
      "http://192.168.100.3:3000", // Explicitly allow gadget IP
      "http://192.168.100.3:5000",
    ],
    socialProviders: {
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        scope: ["identify", "email", "guilds.members.read", "guilds"],
      },
    },
    oauthConfig: {
      // Reverting to default state strategy (cookies)
    },
    databaseHooks: {
      account: {
        create: {
          after: async (account) => {
            await syncDiscordAvatar(account);
          },
        },
        update: {
          after: async (account) => {
            await syncDiscordAvatar(account);
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 1, // refresh every 1 hour
      cookie: {
        sameSite: "lax", 
        secure: false,
        httpOnly: true,
      },
    },
    advanced: {
      // Disable CSRF for localhost (desktop app) — safe because it runs locally
      disableCSRFCheck: env.NODE_ENV === "development" || env.BETTER_AUTH_URL?.includes("localhost"),
    },
    trustHost: true,
  });

  return auth;
};
