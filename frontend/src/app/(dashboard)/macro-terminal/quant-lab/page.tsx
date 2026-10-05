"use client";

import { YieldCurvePanel } from "@/components/macro-terminal/YieldCurvePanel";
import { CurveExplainerPanel } from "@/components/macro-terminal/CurveExplainerPanel";
import { CentralBankDifferentialsPanel } from "@/components/macro-terminal/CentralBankDifferentialsPanel";

export default function QuantLabPage() {
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[720px] lg:h-[800px]">
      {/* LEFT COLUMN: US Treasury Yield Curve at top, FX Central Bank Differentials at bottom */}
      <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
        <YieldCurvePanel className="flex-[5]" />
        <CentralBankDifferentialsPanel className="flex-[3]" />
      </div>

      {/* RIGHT COLUMN: AI Yield Curve Analysis & Quant Lab (equal height to left column) */}
      <div className="lg:col-span-3 flex flex-col min-h-0">
        <CurveExplainerPanel className="flex-1" />
      </div>
    </div>
  );
}
