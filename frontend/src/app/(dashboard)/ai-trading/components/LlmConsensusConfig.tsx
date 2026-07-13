"use client";

import { Zap, ZapOff, Brain, Clock, Users } from "lucide-react";

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
}: LlmConsensusConfigProps) {
  return (
    <div className="border-t border-gray-800 pt-3 space-y-2">
      <label className="flex items-center gap-2 text-xs text-gray-400 mb-1">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="rounded bg-gray-800 border-gray-600"
        />
        <span className="flex items-center gap-1.5">
          <Brain className="w-3 h-3 text-purple-400" />
          AI Trading Consensus
        </span>
      </label>
      {enabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">
              Approval Threshold ({Math.round(threshold * 100)}%)
            </label>
            <input
              type="range"
              value={threshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
              min={0.3}
              max={0.9}
              step={0.05}
              className="w-full accent-accent-gold"
            />
            <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
              <span>30%</span>
              <span>50%</span>
              <span>90%</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">
              Minimum Providers ({minProviders})
            </label>
            <input
              type="range"
              value={minProviders}
              onChange={(e) => onMinProvidersChange(parseInt(e.target.value))}
              min={1}
              max={6}
              step={1}
              className="w-full accent-accent-gold"
            />
            <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
              <span>1</span>
              <span>3</span>
              <span>6</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">
              Provider Timeout ({(providerTimeoutMs / 1000).toFixed(0)}s)
            </label>
            <input
              type="range"
              value={providerTimeoutMs}
              onChange={(e) => onProviderTimeoutChange(parseInt(e.target.value))}
              min={5000}
              max={30000}
              step={1000}
              className="w-full accent-accent-gold"
            />
            <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
              <span>5s</span>
              <span>15s</span>
              <span>30s</span>
            </div>
          </div>

          <p className="text-[9px] text-gray-600 leading-tight">
            Menjalankan {minProviders}+ LLM via 9Router secara paralel. Timeout {providerTimeoutMs / 1000}s per model. Eksekusi hanya jika ≥{Math.round(threshold * 100)}% model menyetujui.
          </p>

          {/* LLM Model Status */}
          <div className="space-y-1">
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
        </div>
      )}
    </div>
  );
}
