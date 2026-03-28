import { Request, Response, NextFunction } from "express";
import { auth } from "../auth";
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
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.session || !session.user) {
      return apiResponse.unauthorized(res, "Sesi tidak valid atau telah kedaluwarsa.");
    }

    req.user = session.user;
    req.session = session.session;
    
    // Additional check for guild ID can be placed here or during sign-in logic

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return apiResponse.error(res, "Gagal memverifikasi sesi", "AUTH_ERROR", 500);
  }
};
