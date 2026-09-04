import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { apiResponse } from "../utils/api-response";

export interface ValidateTarget {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Generic Zod validation middleware wrapper.
 * Can validate body, query, or params individually or simultaneously.
 *
 * Usage:
 *   router.post("/endpoint", validate({ body: myBodySchema }), controllerHandler);
 *   router.get("/endpoint", validate({ query: myQuerySchema }), controllerHandler);
 */
export function validate(target: ValidateTarget) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (target.body) {
        req.body = (await target.body.parseAsync(req.body)) as any;
      }
      if (target.query) {
        req.query = (await target.query.parseAsync(req.query)) as any;
      }
      if (target.params) {
        req.params = (await target.params.parseAsync(req.params)) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return apiResponse.badRequest(res, "Validasi input gagal", issues);
      }
      return apiResponse.error(
        res,
        "Gagal memproses validasi input",
        "VALIDATION_PROCESS_ERROR",
        500
      );
    }
  };
}

/**
 * Convenience helper to validate body only.
 */
export function validateBody(schema: ZodSchema) {
  return validate({ body: schema });
}

/**
 * Convenience helper to validate query only.
 */
export function validateQuery(schema: ZodSchema) {
  return validate({ query: schema });
}

/**
 * Convenience helper to validate params only.
 */
export function validateParams(schema: ZodSchema) {
  return validate({ params: schema });
}
