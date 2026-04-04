import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { apiResponse } from "../utils/api-response";

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.parse(req.body);
        // Overwrite req.body with parsed body to ensure transformed data reaches the routes
        req.body = parsed;
        (req as any).validatedBody = parsed;
      }

      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        // Overwrite req.query with parsed query
        req.query = parsed as any;
        (req as any).validatedQuery = parsed;
      }

      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        // Overwrite req.params with parsed params
        req.params = parsed as any;
        (req as any).validatedParams = parsed;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(issue => ({
          path: issue.path.join("."),
          message: issue.message,
        }));

        return apiResponse.badRequest(res, "Gagal validasi input", errors);
      }

      next(error);
    }
  };
};
