"use client";

import { YieldCurvePanel } from "@/components/macro-terminal/YieldCurvePanel";
import { CurveExplainerPanel } from "@/components/macro-terminal/CurveExplainerPanel";

export default function QuantLabPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[720px] lg:min-h-[calc(100vh-17rem)]">
      <div className="lg:col-span-2 flex flex-col min-h-0">
        <YieldCurvePanel />
      </div>

      <div className="lg:col-span-3 flex flex-col min-h-0">
        <CurveExplainerPanel />
      </div>
    </div>
  );
}
