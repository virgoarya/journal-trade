import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { expectTypeOf } from "vitest";
import {
  PAYMENT_ENDPOINTS,
  paymentFetch,
  type PaymentOrderType,
  type PaymentPackageType,
  type PaymentTokenRequest,
} from "../payment-endpoints";

/**
 * Regression pins for the payment contract drift.
 *
 * The frontend used to POST to `/api/v1/payment/package`, a route the server
 * never registered (it registers `POST /token`), so the call 404'd through the
 * Next.js proxy. It also called `/confirm` without forwarding the better-auth
 * session cookie, which `requireAuth` needs. These tests fail if either the URL
 * or the credential mode regresses.
 */
describe("payment endpoint contract", () => {
  it("targets the registered /token route, never the removed /package alias", () => {
    expect(PAYMENT_ENDPOINTS.token).toBe("/api/v1/payment/token");
    expect(PAYMENT_ENDPOINTS.token).not.toMatch(/\bpackage\b/);
  });

  it("keeps the confirm route (auth-guarded) and status routes stable", () => {
    expect(PAYMENT_ENDPOINTS.confirm).toBe("/api/v1/payment/confirm");
    expect(PAYMENT_ENDPOINTS.status("pkg_u1_premium_1")).toBe(
      "/api/v1/payment/status/pkg_u1_premium_1",
    );
    expect(PAYMENT_ENDPOINTS.statusForUser("u1")).toBe(
      "/api/v1/payment/status-for-user/u1",
    );
  });

  it("url-encodes order and user ids", () => {
    expect(PAYMENT_ENDPOINTS.status("a b")).toBe("/api/v1/payment/status/a%20b");
    expect(PAYMENT_ENDPOINTS.statusForUser("a/b")).toBe(
      "/api/v1/payment/status-for-user/a%2Fb",
    );
  });

  it("keeps orderType package-based (token_topup is historical only)", () => {
    expectTypeOf<PaymentOrderType>().toEqualTypeOf<"registration" | "package">();
    expectTypeOf<PaymentOrderType>().not.toMatchTypeOf<"token_topup">();
    expectTypeOf<PaymentPackageType>().toEqualTypeOf<"basic" | "pro" | "premium">();
  });
});

describe("paymentFetch — session cookie forwarding", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends credentials: include so requireAuth can read the session cookie", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    await paymentFetch(PAYMENT_ENDPOINTS.confirm, { method: "POST", body: "{}" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(PAYMENT_ENDPOINTS.confirm);
    expect(init.credentials).toBe("include");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("preserves caller-supplied headers while forcing the credential mode", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    await paymentFetch(PAYMENT_ENDPOINTS.token, {
      method: "POST",
      headers: { "X-Trace": "abc" },
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers).toMatchObject({ "X-Trace": "abc" });
    expect(init.credentials).toBe("include");
  });

  it("never embeds a hard-coded credential", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const req: PaymentTokenRequest = {
      userId: "u1",
      amountIDR: 3_500_000,
      isBooster: false,
      orderType: "package",
      packageType: "premium",
    };
    await paymentFetch(PAYMENT_ENDPOINTS.token, {
      method: "POST",
      body: JSON.stringify(req),
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(JSON.stringify(init.headers)).not.toMatch(/bearer/i);
  });
});
