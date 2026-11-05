import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PaymentStatusBanner } from "../PaymentStatusBanner";
import { PAYMENT_ENDPOINTS } from "@/lib/payment-endpoints";

/**
 * Regression pins for the package-access banner.
 *
 * The old banner read `tokenBalance` / `hasInsufficientToken` / `isUnlimited`,
 * none of which the backend ever returns: the token meter rendered `undefined`
 * and the "Isi Ulang Token" button was gated on a field that could never be
 * true, so it was permanently unreachable. Access is package-based now.
 */
const fetchMock = vi.fn();

function respond(payload: unknown, ok = true) {
  fetchMock.mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  });
}

describe("PaymentStatusBanner — package access contract", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads the canonical status-for-user endpoint", async () => {
    respond({ isRegistered: true, hasAccess: true, isBooster: false, plan: "premium" });

    render(<PaymentStatusBanner userId="user-1" onUpgrade={() => {}} />);

    await waitFor(() => expect(screen.getByText("Status Akses")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(PAYMENT_ENDPOINTS.statusForUser("user-1"));
  });

  it("derives the active state from hasAccess (never from a token field)", async () => {
    respond({ isRegistered: true, hasAccess: true, isBooster: false, plan: "premium" });

    render(<PaymentStatusBanner userId="user-1" onUpgrade={() => {}} />);

    await waitFor(() => expect(screen.getByText(/Akses seumur hidup/i)).toBeInTheDocument());
    expect(screen.queryByText(/Token Habis/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Token Hampir Habis/i)).not.toBeInTheDocument();
  });

  it("offers package purchase when access is missing, and never the removed top-up control", async () => {
    respond({ isRegistered: false, hasAccess: false, isBooster: false });

    render(<PaymentStatusBanner userId="user-1" onUpgrade={() => {}} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Beli Paket/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /Isi Ulang Token/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Token LLM/i)).not.toBeInTheDocument();
  });

  it("wires the package button to the upgrade handler", async () => {
    respond({ isRegistered: false, hasAccess: false, isBooster: false });
    const onUpgrade = vi.fn();

    render(<PaymentStatusBanner userId="user-1" onUpgrade={onUpgrade} />);

    const button = await screen.findByRole("button", { name: /Beli Paket/i });
    button.click();

    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("shows the expiry date when access is time-limited", async () => {
    respond({
      isRegistered: true,
      hasAccess: true,
      isBooster: false,
      plan: "basic",
      accessEndDate: "2027-01-01T00:00:00.000Z",
    });

    render(<PaymentStatusBanner userId="user-1" onUpgrade={() => {}} />);

    await waitFor(() => expect(screen.getByText(/Akses sampai/i)).toBeInTheDocument());
    expect(screen.queryByText(/Akses seumur hidup/i)).not.toBeInTheDocument();
  });

  it("renders nothing until the status resolves", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    const { container } = render(<PaymentStatusBanner userId="user-1" onUpgrade={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });
});
