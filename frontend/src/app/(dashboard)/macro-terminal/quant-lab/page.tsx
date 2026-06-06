"use client";

import { YieldCurvePanel } from "@/components/macro-terminal/YieldCurvePanel";
import { VixRegimePanel } from "@/components/macro-terminal/VixRegimePanel";

export default function QuantLabPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[500px]">
      {/* Kolom Kiri: Yield Curve (2/5) */}
      <div className="lg:col-span-2">
        <YieldCurvePanel />
      </div>

      {/* Kolom Kanan: VIX Regime (3/5) */}
      <div className="lg:col-span-3">
        <VixRegimePanel />
      </div>
    </div>
  );
}
