"use client";

interface Props {
  enabled: boolean;
  threshold: number;
  debateMode: "parallel" | "sequential";
  memoryEnabled: boolean;
  toolEnabled: boolean;
  onToggle: (value: boolean) => void;
  onThresholdChange: (value: number) => void;
  onDebateModeChange: (value: "parallel" | "sequential") => void;
  onMemoryChange: (value: boolean) => void;
  onToolChange: (value: boolean) => void;
}

export function AgentConsensusConfig({
  enabled,
  threshold,
  debateMode,
  memoryEnabled,
  toolEnabled,
  onToggle,
  onThresholdChange,
  onDebateModeChange,
  onMemoryChange,
  onToolChange,
}: Props) {
  return (
    <div className="border-t border-accent-gold/20 pt-3 mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-accent-gold uppercase tracking-wider">Agent Consensus</p>
          <p className="text-[10px] text-text-muted">Hawk · Dove · Contrarian</p>
        </div>
        <label className="flex items-center gap-2 text-[10px] text-text-muted cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="accent-accent-gold" />
          Enabled
        </label>
      </div>
      <label className="block text-[10px] text-text-muted">
        Threshold: {Math.round(threshold * 100)}%
        <input aria-label="Agent consensus threshold" type="range" min="0.5" max="1" step="0.05" value={threshold} onChange={(e) => onThresholdChange(Number(e.target.value))} className="w-full accent-accent-gold" />
      </label>
      <label className="flex items-center justify-between text-[10px] text-text-muted">
        Debate mode
        <select aria-label="Agent debate mode" value={debateMode} onChange={(e) => onDebateModeChange(e.target.value as "parallel" | "sequential")} className="bg-black/40 border border-accent-gold/20 rounded px-2 py-1 text-accent-gold">
          <option value="parallel">Parallel</option>
          <option value="sequential">Sequential</option>
        </select>
      </label>
      <label className="flex items-center justify-between text-[10px] text-text-muted cursor-pointer">
        Memory injection
        <input aria-label="Enable agent memory" type="checkbox" checked={memoryEnabled} onChange={(e) => onMemoryChange(e.target.checked)} className="accent-accent-gold" />
      </label>
      <label className="flex items-center justify-between text-[10px] text-text-muted cursor-pointer">
        Tool use
        <input aria-label="Enable agent tools" type="checkbox" checked={toolEnabled} onChange={(e) => onToolChange(e.target.checked)} className="accent-accent-gold" />
      </label>
    </div>
  );
}
