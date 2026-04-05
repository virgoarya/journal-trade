// Force Google DNS for SRV lookups (MongoDB Atlas requires SRV resolution)
// Indonesian ISPs often block or don't support SRV DNS queries
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

import express from "express";
import next from "next";
import { env } from "./config/env";
import { corsMiddleware } from "./config/cors";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { connectDB } from "./db/mongoose";
import { createAuth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { setAuthInstance } from "./auth-context";
import path from "node:path";

// Next.js app setup
const dev = process.env.NODE_ENV !== "production";
const nextAppDir = path.join(process.cwd(), "..", "frontend");
const nextApp = next({ dev, dir: nextAppDir });

const app = express();

// CORS - must be first
app.use(corsMiddleware);

// JSON body parser — SKIP for /api/auth routes (Better Auth needs raw stream)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth")) {
    return next();
  }
  return express.json()(req, res, next);
});

// Health route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = env.PORT || 5000;

// Initialize after DB connection
connectDB()
  .then(async () => {
    try {
      const auth = createAuth();
      setAuthInstance(auth);
      const authHandler = toNodeHandler(auth);

      // ─── Better Auth Middleware ───
      // CRITICAL: Do NOT use app.use("/api/auth", handler).
      // Express 5 strips the mount path from req.url, so the handler
      // receives "/callback/discord" instead of "/api/auth/callback/discord".
      // Better Auth needs the FULL path to match its internal routes.
      app.use((req, res, next) => {
        if (req.url.startsWith("/api/auth")) {
          console.log(`[AUTH] ${req.method} ${req.url}`);
          authHandler(req, res).catch((err: unknown) => {
            console.error("❌ Auth error:", err);
            next(err);
          });
        } else {
          next();
        }
      });

      // Other API routes
      app.use("/api", apiRoutes);

      // Next.js request handler (must be after API routes)
      app.all(/.*/, (req, res) => {
        return nextApp.getRequestHandler()(req, res);
      });

      // Error handler
      app.use(errorHandler);

      // Start server after Next.js is prepared
      await nextApp.prepare();
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`✅ Auth ready at ${env.BETTER_AUTH_URL}/api/auth`);
        console.log(`✅ Frontend ready`);
      });
    } catch (error) {
      console.error("❌ Failed to initialize:", error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  });
