/**
 * useAdaptivePolling — jalankan callback secara berkala hanya saat:
 *   1. Tab browser visible (document.visibilityState === "visible")
 *   2. Elemen ref sedang di viewport (IntersectionObserver threshold 0.1)
 *
 * Spec: Fase 2.3 — Realtime Hardening
 *
 * Saat salah satu kondisi tidak terpenuhi, interval di-pause.
 * Saat kembali visible/in-viewport, langsung jalankan callback sekali
 * (bukan menunggu interval berikutnya).
 *
 * Penggunaan:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useAdaptivePolling({ ref, ms: 30_000, fn: () => void load(true) });
 */
import { useCallback, useEffect, useRef } from "react";

interface AdaptivePollingOptions {
  /** Elemen yang dipantau viewport-nya. Bila null/undefined, skip IntersectionObserver. */
  ref?: React.RefObject<Element | null>;
  /** Interval polling dalam ms. */
  ms: number;
  /** Callback yang dijalankan. Harus stabil (gunakan useCallback di sisi pemanggil). */
  fn: () => void;
  /** Bila false, polling dinonaktifkan sepenuhnya (mis. saat sedang loading atau ada error). */
  enabled?: boolean;
}

export function useAdaptivePolling({
  ref,
  ms,
  fn,
  enabled = true,
}: AdaptivePollingOptions): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const tabVisible = useRef(true);
  const inViewport = useRef(true); // default true bila tidak pakai ref
  const timerId = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Jalankan fn lalu jadwalkan eksekusi berikutnya selama kondisi aktif. */
  const schedule = useCallback(() => {
    if (timerId.current) clearTimeout(timerId.current);

    timerId.current = setTimeout(() => {
      if (enabled && tabVisible.current && inViewport.current) {
        fnRef.current();
      }
      schedule();
    }, ms);
  }, [enabled, ms]);

  /** Dipanggil saat kondisi baru terpenuhi — langsung execute satu kali. */
  const resume = useCallback(() => {
    if (!enabled || !tabVisible.current || !inViewport.current) return;
    fnRef.current();
    schedule();
  }, [enabled, schedule]);

  const pause = useCallback(() => {
    if (timerId.current) {
      clearTimeout(timerId.current);
      timerId.current = null;
    }
  }, []);

  // Tab visibility
  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      const wasVisible = tabVisible.current;
      tabVisible.current = visible;
      if (visible && !wasVisible) {
        resume();
      } else if (!visible) {
        pause();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [resume, pause]);

  // Viewport — IntersectionObserver
  // Guard: jsdom (test) dan SSR tidak menyediakan IntersectionObserver.
  // Bila tidak ada, anggap selalu in-viewport (polling tetap jalan).
  useEffect(() => {
    const el = ref?.current;
    if (!el) return; // tidak ada ref → inViewport tetap true
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasIn = inViewport.current;
        inViewport.current = entry.isIntersecting;
        if (entry.isIntersecting && !wasIn) {
          resume();
        } else if (!entry.isIntersecting && wasIn) {
          pause();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, resume, pause]);

  // Interval utama
  useEffect(() => {
    if (!enabled) {
      pause();
      return;
    }
    schedule();
    return () => {
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [enabled, ms, schedule, pause]);
}
