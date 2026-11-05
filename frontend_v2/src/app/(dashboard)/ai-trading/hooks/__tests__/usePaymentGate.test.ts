import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePaymentGate } from "../usePaymentGate";

/**
 * The package-only payment model (ADR: docs/payment package-only access model).
 *
 * `usePaymentGate` must decide access from `status.isPaid` alone. The old
 * token-balance model is gone: there is no token top-up, so a registered
 * package holder is never asked to refill. Regression coverage here pins the
 * decision table so a future revert to `hasInsufficientToken` cannot ship
 * unnoticed.
 */

const fetchMock = vi.fn();

function setStatus(payload: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

function setStatusError(status = 500) {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  });
}

function renderGate(userId = "user-1") {
  return renderHook((props: { userId: string; forceFull: boolean }) =>
    usePaymentGate(props.userId, props.forceFull),
    { initialProps: { userId, forceFull: true } });
}

describe("usePaymentGate — package-only access decision", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lets a paid package holder straight in", async () => {
    setStatus({
      userId: "user-1",
      isRegistered: true,
      hasAccess: true,
      isPaid: true,
      isBooster: false,
    });

    const { result } = renderGate();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.gateAction).toBe("none");
    expect(result.current.error).toBeNull();
  });

  it("maps hasAccess to isPaid so a paid holder is not gated to package", async () => {
    // REAL backend shape (getPaymentStatus): no `isPaid` key is sent, only
    // `hasAccess`. Before the fix fetchStatus left isPaid undefined → falsy →
    // gateAction "package", locking every paying customer out.
    setStatus({
      userId: "user-paid",
      isRegistered: true,
      hasAccess: true,
      isBooster: false,
      plan: "premium",
      is_lifetime: true,
    });

    const { result } = renderGate("user-paid");

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status?.isPaid).toBe(true);
    expect(result.current.gateAction).toBe("none");
  });

  it("still gates when the backend reports hasAccess: false", async () => {
    setStatus({
      userId: "user-lapsed",
      isRegistered: true,
      hasAccess: false,
      isBooster: false,
      plan: "basic",
    });

    const { result } = renderGate("user-lapsed");

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status?.isPaid).toBe(false);
    expect(result.current.gateAction).toBe("package");
  });

  it("never asks a paid holder to refill tokens", async () => {
    // Even with the legacy token fields populated to "insufficient", the
    // package-only model must ignore them.
    setStatus({
      userId: "user-1",
      isRegistered: true,
      hasAccess: true,
      isPaid: true,
      tokenBalance: 0,
      hasInsufficientToken: true,
      isUnlimited: false,
      isBooster: false,
    });

    const { result } = renderGate();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.gateAction).toBe("none");
  });

  it("gates an unpaid user to the package purchase flow", async () => {
    setStatus({
      userId: "user-2",
      isRegistered: false,
      hasAccess: false,
      isPaid: false,
      isBooster: false,
    });

    const { result } = renderGate("user-2");

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.gateAction).toBe("package");
  });

  it("keeps gateAction null until the status resolves", async () => {
    setStatus({ userId: "user-3", isRegistered: true, hasAccess: true, isPaid: true });
    const { result } = renderGate("user-3");

    expect(result.current.loading).toBe(true);
    expect(result.current.gateAction).toBeNull();
    expect(result.current.status).toBeNull();
  });

  it("holds gateAction null and reports an error when the endpoint fails", async () => {
    setStatusError(500);

    const { result } = renderGate();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.gateAction).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.error).toContain("500");
  });

  it("surfaces 'package' when a 200 response carries isPaid: false", async () => {
    setStatus({ userId: "user-4", isRegistered: true, hasAccess: false, isPaid: false, isBooster: false });

    const { result } = renderGate("user-4");

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.gateAction).toBe("package");
  });

  it("re-reads the gate on refetch and flips to 'none' once paid", async () => {
    setStatus({ userId: "user-5", isRegistered: false, hasAccess: false, isPaid: false, isBooster: false });

    const { result } = renderGate("user-5");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.gateAction).toBe("package");

    setStatus({ userId: "user-5", isRegistered: true, hasAccess: true, isPaid: true, isBooster: false });
    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.gateAction).toBe("none"));
  });

  it("bypasses the network entirely in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const { result } = renderHook(() => usePaymentGate("user-dev"));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.gateAction).toBe("none");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
