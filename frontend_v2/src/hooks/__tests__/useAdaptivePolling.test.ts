/**
 * Test useAdaptivePolling — Fase 2.3 Realtime Hardening.
 *
 * Menguji: interval dasar, pause saat tab hidden, resume instan saat visible,
 * flag enabled, dan guard IntersectionObserver yang tidak ada di jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAdaptivePolling } from "../useAdaptivePolling";

/** Set document.visibilityState + dispatch event. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useAdaptivePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("memanggil fn setelah interval berlalu", () => {
    const fn = vi.fn();
    renderHook(() => useAdaptivePolling({ ms: 1000, fn }));

    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("pause saat tab hidden", () => {
    const fn = vi.fn();
    renderHook(() => useAdaptivePolling({ ms: 1000, fn }));

    act(() => {
      setVisibility("hidden");
      vi.advanceTimersByTime(10_000);
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it("langsung memanggil fn saat tab kembali visible", () => {
    const fn = vi.fn();
    renderHook(() => useAdaptivePolling({ ms: 1000, fn }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      setVisibility("hidden");
      vi.advanceTimersByTime(5000);
    });
    expect(fn).toHaveBeenCalledTimes(1); // tidak bertambah saat hidden

    act(() => {
      setVisibility("visible");
    });
    expect(fn).toHaveBeenCalledTimes(2); // resume instan
  });

  it("tidak berjalan saat enabled=false", () => {
    const fn = vi.fn();
    renderHook(() => useAdaptivePolling({ ms: 1000, fn, enabled: false }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it("berhenti saat enabled berubah menjadi false", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useAdaptivePolling({ ms: 1000, fn, enabled }),
      { initialProps: { enabled: true } }
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("tetap polling saat IntersectionObserver tidak tersedia (jsdom/SSR)", () => {
    // jsdom tidak menyediakan IntersectionObserver — hook harus tetap aman.
    expect(typeof (globalThis as any).IntersectionObserver).toBe("undefined");

    const fn = vi.fn();
    const el = document.createElement("div");
    const ref = { current: el } as React.RefObject<HTMLDivElement>;

    renderHook(() => useAdaptivePolling({ ref, ms: 1000, fn }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
