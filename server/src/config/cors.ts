import cors from "cors";
import { env } from "./env";

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Electron, mobile apps, local tools)
    if (!origin) return callback(null, true);
    
    // Always allow configured FRONTEND_URL
    if (origin === env.FRONTEND_URL) return callback(null, true);

    // Allow localhost and local LAN IPs (e.g. for accessing from phone on same WiFi)
    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      origin.startsWith("http://192.168.") ||
      origin.startsWith("http://10.") ||
      origin.startsWith("http://172.")
    ) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-requested-with", "referer", "origin"],
  exposedHeaders: ["Set-Cookie"],
};

export const corsMiddleware = cors(corsOptions);
