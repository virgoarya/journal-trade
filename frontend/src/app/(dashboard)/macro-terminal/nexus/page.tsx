"use client";

import React from "react";
import { Network } from "lucide-react";

export default function NexusPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full glass border border-border-subtle rounded-xl p-8">
      <div className="p-4 rounded-full bg-accent-gold/10 border border-accent-gold/20 mb-4 animate-pulse">
        <Network className="w-12 h-12 text-accent-gold" />
      </div>
      <h2 className="text-2xl font-bold font-mono text-text-primary tracking-wide mb-2">
        CAUSAL LOOP <span className="text-accent-gold">NEXUS</span>
      </h2>
      <p className="text-sm text-text-muted font-mono tracking-widest uppercase text-center max-w-md">
        Interactive macro node-based visualization mapping economic events to market reactions. Coming soon.
      </p>
    </div>
  );
}
