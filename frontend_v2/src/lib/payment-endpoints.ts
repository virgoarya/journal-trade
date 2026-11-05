/**
 * Canonical payment HTTP contract (frontend side).
 *
 * Frozen by the payment contract review:
 *   - live endpoint  : POST /api/v1/payment/token
 *   - order types    : "registration" | "package"  (package-based access)
 *   - token_topup    : historical compatibility ONLY, never an accepted order type
 *   - status response: isRegistered, hasAccess, isBooster, plan, accessEndDate
 *
 * Every request is same-origin and goes through the Next.js proxy
 * (`/api/*` -> BACKEND_URL, see frontend/next.config.ts `rewrites()`).
 *
 * Auth contract: the server's `requireAuth` resolves the better-auth session
 * from the request COOKIE (`authInstance.api.getSession({ headers })`), not from
 * a bearer token. So the client must forward the session cookie — `credentials:
 * "include"` — and must never embed or fall back to a hard-coded credential.
 */

export const PAYMENT_ENDPOINTS = {
  /** POST — create a Midtrans Snap token. Payload orderType: registration | package. */
  token: "/api/v1/payment/token",
  /** POST — finalize a payment from the client (requires the session cookie). */
  confirm: "/api/v1/payment/confirm",
  /** GET — Midtrans transaction status for a single order. */
  status: (orderId: string) =>
    `/api/v1/payment/status/${encodeURIComponent(orderId)}`,
  /** GET — package access status for a user. */
    statusForUser: (userId: string) =>
      `/api/v1/payment/status-for-user/${encodeURIComponent(userId)}`,
    /** GET — price catalog for frontend display (public, no auth). */
    prices: (isBooster?: boolean) =>
      `/api/v1/payment/prices${isBooster ? "?isBooster=true" : ""}`,
  } as const;

export type PaymentOrderType = "registration" | "package";
export type PaymentPackageType = "basic" | "pro" | "premium";

export interface PaymentTokenRequest {
  userId: string;
  amountIDR: number;
  isBooster?: boolean;
  orderType: PaymentOrderType;
  packageType?: PaymentPackageType;
}

export interface PaymentTokenResponse {
  token: string;
  orderId: string;
}

/**
 * Canonical response of GET /api/v1/payment/status-for-user/:userId
 * (see server/src/services/payment.service.ts `getPaymentStatus`).
 *
 * The endpoint never sends `isPaid`; consumers derive it from `hasAccess`.
 * `tokenBalance` / `hasInsufficientToken` do not exist — token top-up was
 * removed, so they must not be read or invented by any consumer.
 */
export interface PaymentStatusResponse {
  isRegistered: boolean;
  hasAccess: boolean;
  isBooster: boolean;
  plan?: string;
  accessEndDate?: string;
}

/**
 * Fetch wrapper that keeps the better-auth session cookie on every payment
 * request, matching the app-wide `apiClient` / `authClient` convention.
 */
export async function paymentFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}
