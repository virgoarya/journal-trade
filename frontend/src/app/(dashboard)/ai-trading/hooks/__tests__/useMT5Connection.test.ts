import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const getStatus = vi.fn();

vi.mock("@/services/ai-trading.service", () => ({
  aiTradingService: {
    getStatus: (...args: unknown[]) => getStatus(...args),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ success: true, data: null }) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useMT5Connection } from "../useMT5Connection";

/**
 * Record the intervals the hook registers while still running the real
 * implementation — `waitFor` from testing-library relies on setInterval for
 * its own polling, so a hard mock would deadlock it.
 */
function recordIntervals() {
  const recorded: { fn: () => void; delay: number; id: number }[] = [];
  const real = globalThis.setInterval;
  vi.spyOn(globalThis, "setInterval").mockImplementation(((
    fn: () => void,
    ms?: number,
  ) => {
    const id = real(fn, ms) as unknown as number;
    recorded.push({ fn, delay: ms ?? 0, id });
    return id;
  }) as unknown as typeof setInterval);
  return recorded;
}

describe("useMT5Connection — reconnect detection", () => {
  beforeEach(() => {
    getStatus.mockReset();
    getStatus.mockResolvedValue({ success: true, data: { connected: false } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps polling while disconnected so a recovered MT5 session is noticed", async () => {
    const intervals = recordIntervals();
    const { result } = renderHook(() => useMT5Connection());

    await waitFor(() => expect(result.current.isCheckingSession).toBe(false));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionStatus).toBe("reconnecting");

    // Offline cadence is the slow one, so a dead MT5 does not hammer the API
    const statusPoll = intervals.find((i) => i.delay === 15000);
    expect(statusPoll, "no 15s offline poll registered").toBeDefined();

    // MT5 comes back on its own — no user action, no page reload
    getStatus.mockResolvedValue({
      success: true,
      data: { connected: true, pipeline: { lastError: null } },
    });

    await act(async () => {
      statusPoll!.fn();
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.isReconnecting).toBe(false);
  });

  it("speeds the poll back up once connected", async () => {
    const intervals = recordIntervals();
    getStatus.mockResolvedValue({
      success: true,
      data: { connected: true, pipeline: { lastError: null } },
    });

    const { result } = renderHook(() => useMT5Connection());

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(intervals.some((i) => i.delay === 5000)).toBe(true);
  });

  it("flags trading_disabled when the broker rejects orders", async () => {
    getStatus.mockResolvedValue({
      success: true,
      data: {
        connected: true,
        pipeline: { lastError: "Trading not permitted by broker" },
      },
    });

    const { result } = renderHook(() => useMT5Connection());

    await waitFor(() =>
      expect(result.current.connectionStatus).toBe("trading_disabled"),
    );
  });

  it("degrades to reconnecting when the status endpoint throws", async () => {
    getStatus.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useMT5Connection());

    await waitFor(() => expect(result.current.isCheckingSession).toBe(false));
    // A network blip is not proof the MT5 session died — the user must not be
    // ejected to the connect panel just because one /status call failed.
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(true);
    expect(result.current.connectionStatus).toBe("reconnecting");
  });

  it("keeps the user in the app when a poll blips after a good session", async () => {
    const intervals = recordIntervals();
    getStatus.mockResolvedValue({
      success: true,
      data: { connected: true, reconnecting: false, pipeline: { lastError: null } },
    });

    const { result } = renderHook(() => useMT5Connection());
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Transient failure on the next poll
    getStatus.mockRejectedValueOnce(new Error("flaky network"));
    const statusPoll = intervals.find((i) => i.delay === 5000);
    await act(async () => {
      await statusPoll!.fn();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionStatus).toBe("reconnecting");
  });
});
