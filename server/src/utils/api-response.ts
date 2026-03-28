import { Response } from "express";

export const apiResponse = {
  success: <T>(res: Response, data: T, status = 200, meta?: any) => {
    return res.status(status).json({
      success: true,
      data,
      ...(meta ? { meta } : {}),
    });
  },

  error: (res: Response, message: string, code: string = "INTERNAL_ERROR", status = 500) => {
    return res.status(status).json({
      success: false,
      error: { code, message },
    });
  },

  unauthorized: (res: Response, message = "Unauthorized") => {
    return apiResponse.error(res, message, "UNAUTHORIZED", 401);
  },

  forbidden: (res: Response, message = "Forbidden") => {
    return apiResponse.error(res, message, "FORBIDDEN", 403);
  },

  notFound: (res: Response, message = "Resource not found") => {
    return apiResponse.error(res, message, "NOT_FOUND", 404);
  },

  badRequest: (res: Response, message = "Bad request", errors?: any) => {
    return res.status(400).json({
      success: false,
      error: {
        code: "BAD_REQUEST",
        message,
        details: errors,
      },
    });
  },
};
