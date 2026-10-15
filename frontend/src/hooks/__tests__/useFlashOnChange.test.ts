/**
 * Test useFlashOnChange — Fase 2.3 Realtime Hardening.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlashOnChange } from "../useFlashOnChange";

describe("useFlashOnChange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tidak memberi kelas pada render pertama", () => {
    const { result } = renderHook(() => useFlashOnChange(100));
    expect(result.current).toBe("");
  });

  it("memberi flash-up saat nilai naik", () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v), {
      initialProps: { v: 100 },
    });

    rerender({ v: 101 });
    expect(result.current).toBe("flash-up");
  });

  it("memberi flash-down saat nilai turun", () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v), {
      initialProps: { v: 100 },
    });

    rerender({ v: 99.5 });
    expect(result.current).toBe("flash-down");
  });

  it("tidak berkedip saat nilai sama", () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v), {
      initialProps: { v: 100 },
    });

    rerender({ v: 100 });
    expect(result.current).toBe("");
  });

  it("kembali kosong setelah durationMs", () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, 600), {
      initialProps: { v: 100 },
    });

    rerender({ v: 101 });
    expect(result.current).toBe("flash-up");

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current).toBe("");
  });

  it("mengabaikan nilai null/undefined/non-finite", () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v), {
      initialProps: { v: null as number | null },
    });
    expect(result.current).toBe("");

    rerender({ v: undefined as unknown as number | null });
    expect(result.current).toBe("");

    rerender({ v: NaN });
    expect(result.current).toBe("");
  });

  it("tidak flash saat nilai pertama datang dari null", () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v), {
      initialProps: { v: null as number | null },
    });

    rerender({ v: 123.45 });
    expect(result.current).toBe("");
  });
});
