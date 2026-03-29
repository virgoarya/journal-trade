import dns from "node:dns";
// Bypassing ISP DNS hijacking for MongoDB SRV records
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import { env } from "./config/env";
import { corsMiddleware } from "./config/cors";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { connectDB, mongoClient } from "./db/mongoose";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { toNodeHandler } from "better-auth/node";

const app = express();

let authHandler: express.RequestHandler;

// Middleware
app.use(corsMiddleware);

// JSON body parser for all routes except auth (auth handles its own parsing)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth")) {
    return next();
  }
  express.json()(req, res, next);
});

// Welcome route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "🚀 Hunter Trades Journal API is Running",
    docs: "/health",
    status: "online"
  });
});

// Health route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use(errorHandler);

const PORT = env.PORT || 5000;

// Initialize everything after DB connection
connectDB().then(() => {
  // Initialize auth with database connection
  const auth = betterAuth({
    database: mongodbAdapter(mongoClient.db()),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        scope: ["identify", "email", "guilds"]
      },
    },
    trustedOrigins: env.NODE_ENV === "production"
      ? [env.FRONTEND_URL]
      : ["http://localhost:3000"],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });

  // Use toNodeHandler to convert to Express middleware
  authHandler = toNodeHandler(auth);

  // Mount auth routes FIRST (highest priority)
  app.use("/api/auth", authHandler);

  // Mount other API routes
  app.use("/api", apiRoutes);

  // Start server after all routes are ready
  app.listen(PORT, () => {
    console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${PORT}`);
    console.log(`📚 Better Auth URL: ${env.BETTER_AUTH_URL}`);
    console.log("✅ Auth initialized with database connection");
  });
});
