import cors from "cors";
import { env } from "./env";

export const corsOptions: cors.CorsOptions = {
  origin: env.NODE_ENV === "production" 
    ? [env.FRONTEND_URL] 
    : [env.FRONTEND_URL, "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

export const corsMiddleware = cors(corsOptions);
