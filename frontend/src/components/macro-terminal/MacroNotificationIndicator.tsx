"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useMacroTerminal } from "@/components/macro-terminal/MacroTerminalContext";

export function MacroNotificationIndicator() {
  const { currentRegime, lastRegime, yieldCurve } = useMacroTerminal();
  const [hasRegimeShift, setHasRegimeShift] = useState(false);

  useEffect(() => {
    if (currentRegime && lastRegime && currentRegime !== lastRegime) {
      setHasRegimeShift(true);
      const timer = setTimeout(() => setHasRegimeShift(false), 60000);
      return () => clearTimeout(timer);
    }
  }, [currentRegime, lastRegime]);

  if (!hasRegimeShift) return null;

  return (
    <div className="relative" title="Regime Shift Detected">
      <Bell className="w-4 h-4 text-yellow-400 animate-pulse" />
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full" />
    </div>
  );
}