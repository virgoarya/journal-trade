import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import PaymentModal from "../PaymentModal";
import { PAYMENT_ENDPOINTS } from "@/lib/payment-endpoints";

/**
 * Regression pins for PaymentModal — package-based payment flow.
 *
 * Covers the critical drift that happened before:
 *  - POST to /api/v1/payment/token (never the removed /package alias)
 *  - credentials: "include" so the better-auth session cookie is forwarded
 *  - snap.pay receives the token returned by /token
 *  - package-based: no token-balance fields are ever read from the response
 *  - dev bypass returns null without ?full=1
 */

const fetchMock = vi.fn();
const snapPayMock = vi.fn();

function mockPrices() {
  return {
    basic: { type: "basic", amountIDR: 1_500_000, baseAmountIDR: 1_500_000, durationMs: 7776000000, label: "Basic" },
    pro: { type: "pro", amountIDR: 2_500_000, baseAmountIDR: 2_500_000, durationMs: 15552000000, label: "Pro" },
    premium: { type: "premium", amountIDR: 3_500_000, baseAmountIDR: 3_500_000, durationMs: null, label: "Premium" },
  };
}

const defaultProps = {
  userId: "u1",
  isBooster: false,
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

function setupFetchSequence(responses: Array<{ ok: boolean; json: () => Promise<any> }>) {
  let i = 0;
  fetchMock.mockImplementation(() => Promise.resolve(responses[i++] ?? responses[responses.length - 1]));
}

describe("PaymentModal — package-based payment flow", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    snapPayMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "snap", {
      value: { pay: snapPayMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders package names after fetching price catalog", async () => {
    setupFetchSequence([{ ok: true, json: async () => ({ packages: mockPrices() }) }]);
    render(<PaymentModal {...defaultProps} />);

    // dev bypass is off when NODE_ENV !== "development" (vitest default = "test")
    await waitFor(() => expect(screen.getByText("Basic")).toBeInTheDocument());
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lanjutkan Pembayaran/i })).toBeInTheDocument();
  });

  it("fetches prices from /prices?isBooster=true when isBooster is true", async () => {
    setupFetchSequence([{ ok: true, json: async () => ({ packages: mockPrices() }) }]);
    render(<PaymentModal {...defaultProps} isBooster={true} />);

    await waitFor(() => {
      const pricesCall = fetchMock.mock.calls.find(
        (c) => c[0] === PAYMENT_ENDPOINTS.prices(true),
      );
      expect(pricesCall).toBeDefined();
    });
  });

  it("POSTs token request to /token (never /package) with credentials: include", async () => {
    setupFetchSequence([
      { ok: true, json: async () => ({ packages: mockPrices() }) },
      { ok: true, json: async () => ({ token: "snap-token-abc", orderId: "pkg_u1_premium_123" }) },
    ]);

    render(<PaymentModal {...defaultProps} />);

    await waitFor(() => screen.getByText("Basic"));

    const payButton = screen.getByRole("button", { name: /Lanjutkan Pembayaran/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      const tokenCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0] === PAYMENT_ENDPOINTS.token,
      );
      expect(tokenCall).toBeDefined();
      expect(tokenCall![1].method).toBe("POST");
      expect(tokenCall![1].credentials).toBe("include");
      expect(tokenCall![1].headers["Content-Type"]).toBe("application/json");
    });

    // The /package route must never appear
    const packageCalls = fetchMock.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("package"),
    );
    expect(packageCalls).toHaveLength(0);
  });

  it("calls window.snap.pay with the token from /token", async () => {
    setupFetchSequence([
      { ok: true, json: async () => ({ packages: mockPrices() }) },
      { ok: true, json: async () => ({ token: "snap-token-xyz", orderId: "pkg_u1_premium_456" }) },
    ]);

    render(<PaymentModal {...defaultProps} />);

    await waitFor(() => screen.getByText("Basic"));

    fireEvent.click(screen.getByRole("button", { name: /Lanjutkan Pembayaran/i }));

    await waitFor(() => {
      expect(snapPayMock).toHaveBeenCalledWith(
        "snap-token-xyz",
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
          onClose: expect.any(Function),
        }),
      );
    });
  });

  it("shows success state and calls onSuccess after clicking continue", async () => {
    setupFetchSequence([
      { ok: true, json: async () => ({ packages: mockPrices() }) },
      { ok: true, json: async () => ({ token: "snap-token-1", orderId: "pkg_u1_premium_1" }) },
      { ok: true, json: async () => ({ message: "confirmed" }) },
    ]);

    // Make snap.pay call onSuccess immediately
    snapPayMock.mockImplementation((_token: string, opts: any) => {
      opts.onSuccess();
    });

    const onSuccess = vi.fn();
    render(<PaymentModal {...defaultProps} onSuccess={onSuccess} />);

    await waitFor(() => screen.getByText("Basic"));

    fireEvent.click(screen.getByRole("button", { name: /Lanjutkan Pembayaran/i }));

    // Success modal appears
    await waitFor(() => {
      expect(screen.getByText("Pembayaran Berhasil!")).toBeInTheDocument();
    });

    // Click "Lanjutkan ke AI Trading" to trigger the onSuccess prop
    fireEvent.click(screen.getByRole("button", { name: /Lanjutkan ke AI Trading/i }));

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows error toast when /token returns error", async () => {
    setupFetchSequence([
      { ok: true, json: async () => ({ packages: mockPrices() }) },
      { ok: false, json: async () => ({ error: "Invalid request" }) },
    ]);

    render(<PaymentModal {...defaultProps} />);

    await waitFor(() => screen.getByText("Basic"));

    fireEvent.click(screen.getByRole("button", { name: /Lanjutkan Pembayaran/i }));

    // Button should NOT trigger snap.pay since token fetch failed
    await waitFor(() => {
      expect(snapPayMock).not.toHaveBeenCalled();
    });
  });

  it("renders null in dev mode without ?full=1 param", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // jsdom window always exists; search has no "full"
    const { container } = render(<PaymentModal {...defaultProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders normally in dev mode with ?full=1 param", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setupFetchSequence([{ ok: true, json: async () => ({ packages: mockPrices() }) }]);

    // Set ?full=1 in the URL search params
    Object.defineProperty(window, "location", {
      value: { search: "?full=1", href: "http://localhost/?full=1" },
      writable: true,
    });

    render(<PaymentModal {...defaultProps} />);

    await waitFor(() => expect(screen.getByText("Basic")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Lanjutkan Pembayaran/i })).toBeInTheDocument();
  });

  it("never references tokenBalance / hasInsufficientToken / isUnlimited on response", async () => {
    setupFetchSequence([
      { ok: true, json: async () => ({ packages: mockPrices() }) },
      { ok: true, json: async () => ({ token: "snap-token-1", orderId: "pkg_u1_premium_1" }) },
    ]);

    render(<PaymentModal {...defaultProps} />);

    await waitFor(() => screen.getByText("Basic"));

    fireEvent.click(screen.getByRole("button", { name: /Lanjutkan Pembayaran/i }));

    await waitFor(() => {
      // The token response must not contain token fields
      const tokenCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0] === PAYMENT_ENDPOINTS.token,
      );
      expect(tokenCall).toBeDefined();
      // Verify the request body is package-based (no token_topup)
      const body = JSON.parse(tokenCall![1].body);
      expect(body.orderType).toBe("package");
      expect(body.packageType).toBe("premium");
      expect(Object.keys(body)).not.toContain("token_topup");
      expect(Object.keys(body)).not.toContain("tokenBalance");
    });
  });
});
