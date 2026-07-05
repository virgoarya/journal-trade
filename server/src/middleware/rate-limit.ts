import rateLimit from "express-rate-limit";

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this IP, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for AI endpoints - 20 requests per 15 minutes
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      code: "AI_RATE_LIMIT_EXCEEDED",
      message: "Too many AI requests, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints - 5 login attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
