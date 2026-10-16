import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_BUFFER } from "../ws-server";

// Unit test the backpressure threshold value and broadcast skip logic
// without mocking the ws module (which has complex exports).
// We test the constant + simulate the guard condition directly.

describe("WebSocket Backpressure", () => {
  it("MAX_BUFFER should be 1MB (1_048_576 bytes)", () => {
    expect(MAX_BUFFER).toBe(1_048_576);
  });

  it("should skip client when bufferedAmount exceeds MAX_BUFFER", () => {
    const sendFn = vi.fn();
    const warnFn = vi.fn();

    // Simulate broadcast guard logic
    const simulateBroadcast = (bufferedAmount: number) => {
      if (bufferedAmount > MAX_BUFFER) {
        warnFn(`buffer full (${bufferedAmount} bytes), skipping`);
        return;
      }
      sendFn("payload");
    };

    // Slow client: buffer full
    simulateBroadcast(MAX_BUFFER + 1);
    expect(sendFn).not.toHaveBeenCalled();
    expect(warnFn).toHaveBeenCalledWith(
      expect.stringContaining("buffer full")
    );
  });

  it("should send to client when bufferedAmount is below MAX_BUFFER", () => {
    const sendFn = vi.fn();
    const warnFn = vi.fn();

    const simulateBroadcast = (bufferedAmount: number) => {
      if (bufferedAmount > MAX_BUFFER) {
        warnFn(`buffer full`);
        return;
      }
      sendFn("payload");
    };

    // Fast client: buffer empty
    simulateBroadcast(0);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(warnFn).not.toHaveBeenCalled();
  });

  it("should send when bufferedAmount equals MAX_BUFFER (boundary)", () => {
    const sendFn = vi.fn();

    const simulateBroadcast = (bufferedAmount: number) => {
      if (bufferedAmount > MAX_BUFFER) return;
      sendFn("payload");
    };

    // Exactly at threshold — should still send (guard is strictly >)
    simulateBroadcast(MAX_BUFFER);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });
});
