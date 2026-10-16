import { describe, it, expect, vi, beforeEach } from "vitest";

// The native MCP streamer owns the real transport. Mock it so the test can
// drive the streamer's connection state without a live MetaTrader 5 terminal.
const streamerState = { connected: false, reconnecting: false };
const connectWithMcpConfigMock = vi.fn();

vi.mock("../../mt5-streamer", () => ({
  mt5StreamCache: {
    getPositions: () => [],
    getOrders: () => [],
    getAccountInfo: () => null,
    isConnected: () => streamerState.connected,
    isReconnecting: () => streamerState.reconnecting,
  },
  executeMt5Command: vi.fn(),
  connectWithMcpConfig: (...args: any[]) => connectWithMcpConfigMock(...args),
  disconnectMcp: vi.fn(),
  forceReconnect: vi.fn(),
}));

const { mt5McpService } = await import("../mt5-mcp.service");

describe("mt5McpService connection state — the streamer is authoritative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamerState.connected = false;
    streamerState.reconnecting = false;
    // Reset the service's own flag without touching the streamer mock.
    mt5McpService.forceDisconnect();
  });

  it("reports connected when the streamer healed the connection on its own", () => {
    // Regression: this.connected was only ever set by an explicit
    // connectToMT5() call, so after the streamer's auto-reconnect loop
    // restored the transport the service still claimed "disconnected",
    // freezing the pipeline in waitingReconnect forever.
    streamerState.connected = true;
    expect(mt5McpService.isConnected).toBe(true);
  });

  it("reports disconnected when neither the service nor the streamer is connected", () => {
    streamerState.connected = false;
    expect(mt5McpService.isConnected).toBe(false);
  });

  it("reports connected after an explicit connectToMT5, even if the streamer cache lags", async () => {
    connectWithMcpConfigMock.mockResolvedValue({
      success: true,
      accountInfo: { login: 123, balance: 1000, equity: 1000 },
    });
    streamerState.connected = false;

    const res = await mt5McpService.connectToMT5({ apiKey: "test-key" } as any);

    expect(res.success).toBe(true);
    expect(mt5McpService.isConnected).toBe(true);
  });

  it("surfaces the streamer's reconnect window via isReconnectingStatus", () => {
    // Regression: the service's own flag is only set on the legacy (unused)
    // reconnect path, so /status.reconnecting was permanently false and the
    // client's reconnect overlay never appeared — the user was ejected to the
    // connect panel on every transient blip.
    streamerState.connected = false;
    streamerState.reconnecting = true;

    expect(mt5McpService.isReconnectingStatus).toBe(true);
    expect(mt5McpService.isConnected).toBe(false);
  });

  it("does not report a reconnect window when fully connected", () => {
    streamerState.connected = true;
    streamerState.reconnecting = false;

    expect(mt5McpService.isReconnectingStatus).toBe(false);
    expect(mt5McpService.isConnected).toBe(true);
  });
});
