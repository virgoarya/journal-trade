"use client";

import React, { useState } from "react";
import { Brain, Radar, Table2 } from "lucide-react";
import { GeoRiskRadarPanel } from "@/components/macro-terminal/GeoRiskRadarPanel";
import { AgentIntelligencePanel } from "@/components/agent-intelligence-panel";
import { AiPersonaChatPanel } from "@/components/macro-terminal/AiPersonaChatPanel";
import {
  WidgetWorkspaceProvider,
  useWidgetWorkspaceEnabled,
} from "@/components/macro-terminal/workspace/WidgetWorkspaceProvider";
import { WidgetGrid } from "@/components/macro-terminal/workspace/WidgetGrid";
import { WidgetShell } from "@/components/macro-terminal/workspace/WidgetShell";
import { MacroScreener } from "@/components/macro-terminal/MacroScreener";

/** Header + switcher Intelligence / 1-on-1 Chat (dipakai di dalam WidgetShell). */
function IntelligenceSwitcher() {
  const [activeTab, setActiveTab] = useState<"intelligence" | "personaChat">("intelligence");

  return (
    <div className="flex flex-col h-full">
      {/* Switcher */}
      <div className="flex items-center justify-end pb-3 mb-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-1 bg-bg-elevated/50 rounded-lg p-1 border border-border-subtle">
          <button
            onClick={() => setActiveTab("intelligence")}
            className={`px-3 py-1 font-mono text-xs font-semibold rounded transition-all ${
              activeTab === "intelligence"
                ? "bg-accent-gold text-bg-void font-bold shadow"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Intelligence &amp; Debate
          </button>
          <button
            onClick={() => setActiveTab("personaChat")}
            className={`px-3 py-1 font-mono text-xs font-semibold rounded transition-all ${
              activeTab === "personaChat"
                ? "bg-accent-gold text-bg-void font-bold shadow"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            1-on-1 Chat
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "intelligence" && <AgentIntelligencePanel />}
        {activeTab === "personaChat" && <AiPersonaChatPanel />}
      </div>
    </div>
  );
}

/** Layout lama — dipakai saat feature flag OFF. */
function LegacyIntelligence() {
  const [activeTab, setActiveTab] = useState<"intelligence" | "personaChat">("intelligence");

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Baris atas: Geo-Risk (2/5) + AI Command (3/5) */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[720px] lg:h-[800px]">
      {/* Left: Geo-Risk Radar (2/5) */}
      <div className="lg:col-span-2 flex flex-col min-h-0 h-full overflow-y-auto custom-scrollbar pr-2">
        <GeoRiskRadarPanel />
      </div>

      {/* Right: Agent Intelligence / Persona Chat (3/5) */}
      <div className="lg:col-span-3 flex flex-col min-h-0 h-full rounded-xl border border-accent-gold/30 bg-card p-4 shadow-xl">
        {/* Main Panel Header & Switcher */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-accent-gold font-mono text-sm font-bold">&#129504; AI Command &amp; Intelligence</span>
          </div>
          <div className="flex items-center gap-1 bg-bg-elevated/50 rounded-lg p-1 border border-border-subtle">
            <button
              onClick={() => setActiveTab("intelligence")}
              className={`px-3 py-1 font-mono text-xs font-semibold rounded transition-all ${
                activeTab === "intelligence"
                  ? "bg-accent-gold text-bg-void font-bold shadow"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Intelligence &amp; Debate
            </button>
            <button
              onClick={() => setActiveTab("personaChat")}
              className={`px-3 py-1 font-mono text-xs font-semibold rounded transition-all ${
                activeTab === "personaChat"
                  ? "bg-accent-gold text-bg-void font-bold shadow"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              1-on-1 Chat
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === "intelligence" && <AgentIntelligencePanel />}
          {activeTab === "personaChat" && <AiPersonaChatPanel />}
        </div>
      </div>
      </div>

      {/* Screener & Watchlist makro — WAJIB full-width: tabel punya 7 kolom
          (Simbol/Nama/Kategori/Harga/Chg/Sparkline/Aksi). Kalau ditaruh sebagai
          anak grid 5 kolom tanpa col-span, ia hanya dapat 1 kolom (~280px) dan
          kolom Harga ke kanan terpotong. */}
      <MacroScreener className="h-[440px]" />
    </div>
  );
}

export default function IntelligencePage() {
  const enabled = useWidgetWorkspaceEnabled();

  if (!enabled) return <LegacyIntelligence />;

  return (
    <WidgetWorkspaceProvider tab="intelligence" enabled>
      <WidgetGrid tab="intelligence">
        <div key="geo-risk">
          <WidgetShell widgetId="geo-risk" title="Geo Risk Radar" icon={Radar}>
            <GeoRiskRadarPanel />
          </WidgetShell>
        </div>

        <div key="agent-intelligence">
          <WidgetShell
            widgetId="agent-intelligence"
            title="AI Command & Intelligence"
            icon={Brain}
          >
            <IntelligenceSwitcher />
          </WidgetShell>
        </div>
        <div key="macro-screener">
          <WidgetShell
            widgetId="macro-screener"
            title="Macro Screener & Watchlist"
            icon={Table2}
          >
            <MacroScreener className="h-full" />
          </WidgetShell>
        </div>
      </WidgetGrid>
    </WidgetWorkspaceProvider>
  );
}
