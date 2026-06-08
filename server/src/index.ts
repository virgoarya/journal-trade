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
import { startMt5AutoSync } from "./services/mt5-scheduler.service";
import path from "node:path";

// nextapp
const nextAppDir = path.join(__dirname, "..", "..", "frontend");
const nextApp = next({ dev: true, dir: nextAppDir });

const app = express();
app.use(corsMiddleware);
app.use(express.json());

app.get("/health", (req, res) => res.status(200).json({ status: "OK", timestamp: new Date().toISOString() }));

const PORT = env.PORT || 5000;

connectDB()
  .then(async () => {
    try {
      const auth = createAuth();
      setAuthInstance(auth);
      const authHandler = toNodeHandler(auth);
      await startMt5AutoSync();

      app.use((req, res, next) => {
        if (req.url.startsWith("/api/auth")) {
          authHandler(req, res).catch((err) => {
            console.error("Auth error:", err);
            next(err);
          });
        } else {
          next();
        }
      });

      app.use("/api", apiRoutes);
      app.use(errorHandler);

      app.listen(PORT, () => {
        console.log(`API running on port ${PORT}`);
        console.log(`Auth ready at ${env.BETTER_AUTH_URL}/api/auth`);
      });
    } catch (e) {
      console.error("Init failed:", e);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error("DB connection failed:", e);
    process.exit(1);
  });
