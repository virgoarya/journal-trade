import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate, validateBody, validateQuery, validateParams } from "../validate";
import { Request, Response, NextFunction } from "express";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().positive(),
});

function makeReqRes(body: any = {}, query: any = {}, params: any = {}) {
  const req: any = { body, query, params };
  const res: any = {
    statusCode: 0,
    json: vi.fn(function (this: any, payload: any) {
      this._payload = payload;
      return this;
    }),
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe("validate middleware", () => {
  it("passes valid body to next()", async () => {
    const { req, res, next } = makeReqRes({ name: "Virga", age: 30 });
    const mw = validateBody(testSchema);
    await mw(req as Request, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects invalid body with 400 + issues", async () => {
    const { req, res, next } = makeReqRes({ name: "", age: -5 });
    const mw = validateBody(testSchema);
    await mw(req as Request, res as Response, next as unknown as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it("validates query", async () => {
    const { req, res, next } = makeReqRes({}, { name: "x", age: 1 });
    const mw = validateQuery(testSchema);
    await mw(req as Request, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledOnce();
  });

  it("validates params", async () => {
    const { req, res, next } = makeReqRes({}, {}, { name: "y", age: 2 });
    const mw = validateParams(testSchema);
    await mw(req as Request, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledOnce();
  });

  it("combined validate works", async () => {
    const { req, res, next } = makeReqRes(
      { name: "z", age: 3 },
      { name: "z", age: 3 },
      { name: "z", age: 3 }
    );
    const mw = validate({ body: testSchema, query: testSchema, params: testSchema });
    await mw(req as Request, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledOnce();
  });
});
