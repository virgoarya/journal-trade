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
        req.body = schemas.body.parse(req.body);
      }
      
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          path: err.path.join("."),
          message: err.message,
        }));
        
        return apiResponse.badRequest(res, "Gagal validasi input", errors);
      }
      
      next(error);
    }
  };
};
