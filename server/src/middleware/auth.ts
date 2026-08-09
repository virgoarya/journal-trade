import { Request, Response, NextFunction } from "express";
import { authInstance } from "../auth-context";
import { apiResponse } from "../utils/api-response";

// Extend Express Request object to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: any; // Replace with proper Better Auth type if needed
      session?: any;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // DEV-ONLY: integration test bypass (never active in production)
    if (process.env.NODE_ENV === "development" && req.headers["x-integration-test"] === "1") {
      req.user = {
        id: "test_user_integration",
        name: "Integration Test",
        email: "integration.test@journaltrade.local",
      };
      req.session = {};
      return next();
    }

    if (!authInstance) {
      return apiResponse.error(res, "Auth belum diinisialisasi", "SERVER_ERROR", 500);
    }

    const session = await authInstance.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.session || !session.user) {
      return apiResponse.unauthorized(res, "Sesi tidak valid atau telah kedaluwarsa.");
    }

    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return apiResponse.error(res, "Gagal memverifikasi sesi", "AUTH_ERROR", 500);
  }
};
