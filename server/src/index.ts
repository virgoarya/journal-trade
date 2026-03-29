import express from "express";
import { env } from "./config/env";
import { corsMiddleware } from "./config/cors";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { connectDB } from "./db/mongoose";

const app = express();

app.use(corsMiddleware);

// Body parser - Better Auth handles its own parsing, so we skip standard parsing for its route
app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth")) {
    return next();
  }
  express.json()(req, res, next);
});

// API Routes
app.use("/api", apiRoutes);

// General route for healthcheck
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use(errorHandler);

const PORT = env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${PORT}`);
    console.log(`📚 Better Auth URL: ${env.BETTER_AUTH_URL}`);
  });
});
