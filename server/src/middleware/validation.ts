import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { apiResponse } from "../utils/api-response";

interface ValidationSchema {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

/**
 * Middleware to validate Express requests using Zod schemas.
 * Replaces invalid parts with parsed typed versions, or returns a 400 Bad Request
 * with detailed validation errors.
 */
export const validateRequest = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query) as any;
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params) as any;
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return apiResponse.badRequest(res, "Validasi input gagal", formattedErrors);
      }
      return next(error);
    }
  };
};
