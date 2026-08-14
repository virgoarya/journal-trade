"use client";

import { Zap, ZapOff, Brain, Clock, Users, Eye, Table2, Globe } from "lucide-react";

interface LlmConsensusConfigProps {
  enabled: boolean;
  threshold: number;
  minProviders: number;
  providerTimeoutMs: number;
  models: Array<{ name: string; label: string; status: string }>;
  loading: boolean;
  onToggle: (enabled: boolean) => void;
  onThresholdChange: (value: number) => void;
  onMinProvidersChange: (value: number) => void;
  onProviderTimeoutChange: (value: number) => void;
  // Visualization options
  showContributionIndicators?: boolean;
  onShowContributionIndicatorsChange?: (v: boolean) => void;
  showConsensusPanelByDefault?: boolean;
  onShowConsensusPanelByDefaultChange?: (v: boolean) => void;
  visualizationStyle?: "radar" | "cards" | "table";
  onVisualizationStyleChange?: (v: "radar" | "cards" | "table") => void;
}

export function LlmConsensusConfig({
  enabled,
  threshold,
  minProviders,
  providerTimeoutMs,
  models,
  loading,
  onToggle,
  onThresholdChange,
  onMinProvidersChange,
  onProviderTimeoutChange,
  showContributionIndicators = true,
  onShowContributionIndicatorsChange,
  showConsensusPanelByDefault = false,
  onShowConsensusPanelByDefaultChange,
  visualizationStyle = "radar",
  onVisualizationStyleChange,
}: LlmConsensusConfigProps) {
  const styles: { key: "radar" | "cards" | "table"; label: string; icon: React.ElementType }[] = [
    { key: "radar", label: "Radar", icon: Globe },
    { key: "cards", label: "Cards", icon: Eye },
    { key: "table", label: "Table", icon: Table2 },
  ];

  return (
    <div className="border-t border-gray-800 pt-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
        <Brain className="w-3 h-3 text-purple-400" />
        <span className="uppercase tracking-wider font-semibold">AI Model Status</span>
      </div>

      {/* LLM Model Status */}
      <div className="space-y-1 mt-2">
        {loading ? (
          <div className="text-[10px] text-gray-500">Loading model status...</div>
        ) : (
          models.map((m) => (
            <div key={m.name} className="flex items-center gap-2 text-[10px]">
              {m.status === "active" ? (
                <Zap className="w-3 h-3 text-green-400" />
              ) : (
                <ZapOff className="w-3 h-3 text-yellow-500" />
              )}
              <span className="text-gray-400 flex-1">{m.label}</span>
              <span className={`font-medium ${m.status === "active" ? "text-green-400" : "text-yellow-500"}`}>
                {m.status === "active" ? "siap" : "zzz"}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Visualization Options */}
      <div className="mt-3 pt-2 border-t border-gray-800/50 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <Eye className="w-3 h-3 text-accent-gold" />
          <span className="uppercase tracking-wider font-semibold">Viz Options</span>
        </div>

        {/* Style selector */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-400">Style</span>
          <div className="flex gap-1">
            {styles.map((s) => {
              const Icon = s.icon;
              const active = visualizationStyle === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => onVisualizationStyleChange?.(s.key)}
                  className={`px-2 py-1 rounded border text-[9px] uppercase transition ${
                    active
                      ? "bg-accent-gold/20 text-accent-gold border-accent-gold/40"
                      : "text-gray-500 border-gray-700 hover:text-gray-300"
                  }`}
                  title={s.label}
                >
                  <Icon className="w-3 h-3" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle: contribution indicators */}
        <label className="flex items-center justify-between text-[10px] cursor-pointer">
          <span className="text-gray-400">Contribution indicators</span>
          <input
            type="checkbox"
            checked={showContributionIndicators}
            onChange={(e) => onShowContributionIndicatorsChange?.(e.target.checked)}
            className="accent-accent-gold"
          />
        </label>

        {/* Toggle: panel by default */}
        <label className="flex items-center justify-between text-[10px] cursor-pointer">
          <span className="text-gray-400">Panel open by default</span>
          <input
            type="checkbox"
            checked={showConsensusPanelByDefault}
            onChange={(e) => onShowConsensusPanelByDefaultChange?.(e.target.checked)}
            className="accent-accent-gold"
          />
        </label>
      </div>
    </div>
  );
}
