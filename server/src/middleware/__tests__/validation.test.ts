import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { z } from "zod";
import { validateRequest } from "../validation";

describe("Zod validation middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: any;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    nextFunction = vi.fn();
  });

  const testSchema = z.object({
    username: z.string().min(3, "Username minimal 3 karakter"),
    email: z.string().email("Format email tidak valid"),
    age: z.number().int().positive().optional(),
  });

  it("should pass validation and call next() for valid body data", async () => {
    mockRequest.body = {
      username: "alex",
      email: "alex@example.com",
      age: 25,
    };

    const middleware = validateRequest({ body: testSchema });
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it("should reject and return 400 for invalid body data", async () => {
    mockRequest.body = {
      username: "al", // too short
      email: "not-an-email", // invalid email
      age: -5, // not positive
    };

    const middleware = validateRequest({ body: testSchema });
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "BAD_REQUEST",
          message: "Validasi input gagal",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "username" }),
            expect.objectContaining({ field: "email" }),
            expect.objectContaining({ field: "age" }),
          ]),
        }),
      })
    );
  });

  it("should validate and parse query parameters correctly", async () => {
    const querySchema = z.object({
      limit: z.coerce.number().int().positive().default(10),
      search: z.string().optional(),
    });

    mockRequest.query = {
      limit: "25", // string representation of number
      search: "test",
    };

    const middleware = validateRequest({ query: querySchema });
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    // Verify limit has been coerced to number 25
    expect(mockRequest.query?.limit).toBe(25);
  });
});
