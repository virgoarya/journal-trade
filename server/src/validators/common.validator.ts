import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Zod validator for MongoDB ObjectId (24 hex characters)
export const objectIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId MongoDB tidak valid"),
});
