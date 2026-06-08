"use client";

import React from "react";
import { Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MacroTerminalProvider } from "@/components/macro-terminal/MacroTerminalContext";
import { ErrorBoundary } from "@/components/macro-terminal/ErrorBoundary";

const TABS = [
  { name: "Overview", path: "/macro-terminal/overview", icon: "⚡" },
  { name: "Intelligence", path: "/macro-terminal/intelligence", icon: "🧠" },
  { name: "Quant Lab", path: "/macro-terminal/quant-lab", icon: "🧪" },
  { name: "Nexus", path: "/macro-terminal/nexus", icon: "🕸️" },
];

export default function MacroTerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <ErrorBoundary>
      <MacroTerminalProvider>
        <div className="flex flex-col h-[calc(100vh-8rem)] w-full max-w-[1600px] mx-auto gap-4">
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
                <Activity className="w-6 h-6 text-accent-gold" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono text-text-primary tracking-wide">
                  MACRO <span className="text-accent-gold">TERMINAL</span>
                </h1>
                <p className="text-xs text-text-secondary font-mono tracking-widest uppercase">
                  Global Macro & Institutional Flow Dashboard
                </p>
              </div>
            </div>

            {/* Status indicators */}
            <div className="hidden md:flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-data-profit animate-pulse" />
                <span className="text-text-muted">MARKET DATA:</span>
                <span className="text-data-profit">CONNECTED</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-data-profit animate-pulse" />
                <span className="text-text-muted">AI ENGINE:</span>
                <span className="text-data-profit">ONLINE</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-border-subtle pb-0 shrink-0 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const isActive = pathname.startsWith(tab.path);
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-mono text-sm transition-colors border-b-2 whitespace-nowrap ${
                    isActive
                      ? "border-accent-gold text-accent-gold bg-accent-gold/5"
                      : "border-transparent text-text-muted hover:text-text-main hover:bg-surface-elevated/50"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.name}
                </Link>
              );
            })}
          </div>

          {/* Sub-page Content */}
          <div className="flex-1 min-h-0 overflow-visible">
            {children}
          </div>
        </div>
      </MacroTerminalProvider>
    </ErrorBoundary>
  );
}
