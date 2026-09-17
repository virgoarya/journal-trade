import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { authMongoClient } from "../db/mongoose";
import { env } from "../config/env";

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
