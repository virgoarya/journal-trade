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
    </div>
  );
}
