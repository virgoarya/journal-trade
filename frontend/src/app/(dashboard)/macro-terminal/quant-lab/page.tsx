"use client";

import React from "react";
import { Gauge } from "lucide-react";

export default function QuantLabPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full glass border border-border-subtle rounded-xl p-8">
      <div className="p-4 rounded-full bg-accent-gold/10 border border-accent-gold/20 mb-4 animate-pulse">
        <Gauge className="w-12 h-12 text-accent-gold" />
      </div>
      <h2 className="text-2xl font-bold font-mono text-text-primary tracking-wide mb-2">
        QUANTITATIVE <span className="text-accent-gold">LAB</span>
      </h2>
      <p className="text-sm text-text-muted font-mono tracking-widest uppercase text-center max-w-md">
        Yield Curve Inversion, VIX, and Financial Conditions Index metrics. Coming soon.
      </p>
    </div>
  );
}
