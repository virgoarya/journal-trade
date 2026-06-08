import cors from "cors";
import { env } from "./env";

export const corsOptions: cors.CorsOptions = {
  origin: env.NODE_ENV === "production"
    ? [env.FRONTEND_URL]
    : [
        env.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-requested-with", "referer", "origin"],
  exposedHeaders: ["Set-Cookie"],
};

export const corsMiddleware = cors(corsOptions);
