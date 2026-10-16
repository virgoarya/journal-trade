/**
 * useFlashOnChange — beri kelas CSS animasi ("flash-up" | "flash-down")
 * selama `durationMs` ketika nilai numerik berubah.
 *
 * Spec: Fase 2.3 — Realtime Hardening
 *
 * Penggunaan:
 *   const flash = useFlashOnChange(currentPrice, 600);
 *   <span className={`transition-colors ${flash}`}>...</span>
 */
import { useEffect, useRef, useState } from "react";

export type FlashDirection = "flash-up" | "flash-down" | "";

export function useFlashOnChange(
  val: number | undefined | null,
  durationMs = 600
): FlashDirection {
  const [direction, setDirection] = useState<FlashDirection>("");
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (val === undefined || val === null || !Number.isFinite(val)) return;

    if (prevRef.current !== null && prevRef.current !== val) {
      const dir: FlashDirection = val > prevRef.current ? "flash-up" : "flash-down";
      setDirection(dir);
      const timer = setTimeout(() => setDirection(""), durationMs);
      prevRef.current = val;
      return () => clearTimeout(timer);
    }

    prevRef.current = val;
  }, [val, durationMs]);

  return direction;
}
