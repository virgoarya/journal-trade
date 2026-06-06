"use client";

import React from "react";
import { BrainCircuit } from "lucide-react";

export default function IntelligencePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full glass border border-border-subtle rounded-xl p-8">
      <div className="p-4 rounded-full bg-accent-gold/10 border border-accent-gold/20 mb-4 animate-pulse">
        <BrainCircuit className="w-12 h-12 text-accent-gold" />
      </div>
      <h2 className="text-2xl font-bold font-mono text-text-primary tracking-wide mb-2">
        AI EXPERT <span className="text-accent-gold">PERSONAS</span>
      </h2>
      <p className="text-sm text-text-muted font-mono tracking-widest uppercase text-center max-w-md">
        Geopolitical Risk Map & Multi-Agent Analyzer Framework. Coming soon to this terminal.
      </p>
    </div>
  );
}
