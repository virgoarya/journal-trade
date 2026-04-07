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
      debugLogs: true,
      transaction: false, // Atlas free tier does not support transactions
    }),
    debug: true,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:5000",
    ],
    socialProviders: {
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        scope: ["identify", "email", "guilds.members.read", "guilds"],
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 1, // refresh every 1 hour
    },
    advanced: {
      disableCSRFCheck: env.NODE_ENV === "development",
    },
  });

  return auth;
};
