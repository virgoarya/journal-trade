import { Request, Response, NextFunction } from "express";
import { apiResponse } from "../utils/api-response";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🔥 Global Error Handler:", err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Terjadi kesalahan pada server";
  const code = err.code || "INTERNAL_ERROR";

  return apiResponse.error(res, message, code, statusCode);
};
