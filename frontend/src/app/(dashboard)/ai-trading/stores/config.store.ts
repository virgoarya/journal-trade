import { create } from "zustand";
import {
  type AIBacktestSkill,
  type PipelineConfig,
  type MethodologyName,
  type MethodologyWeights,
  DEFAULT_METHODOLOGY_WEIGHTS,
} from "../types";

export interface ConfigState {
  // Low-frequency backtest & pipeline configs
  savedPipelineConfig: PipelineConfig | null;
  skillConfig: AIBacktestSkill | null;
  skillVersion: number;
  lastAutoBacktestAt: string | null;

  // Methodology config
  activeMethodologies: MethodologyName[];
  methodologyWeights: MethodologyWeights;
  showMethodologyConfig: boolean;

  // LLM / Agent consensus config
  llmEnabled: boolean;
  llmThreshold: number;
  llmMinProviders: number;
  llmProviderTimeoutMs: number;
  agentConsensusEnabled: boolean;
  agentConsensusThreshold: number;
  agentConsensusDebateMode: "parallel" | "sequential";
  agentConsensusMemoryEnabled: boolean;
  agentConsensusToolEnabled: boolean;
  macroNewsFailSafe: boolean;
  isSavingSettings: boolean;

  // Circuit breaker state
  circuitBreakerState: "OPEN" | "CLOSED" | "HALF_OPEN" | string;
  circuitBreakerReason: string | null;

  // UI preferences
  showContributionIndicators: boolean;
  showConsensusPanelByDefault: boolean;
  visualizationStyle: "radar" | "cards" | "table";
  isConsensusPanelOpen: boolean;

  // Actions
  setSavedPipelineConfig: (config: PipelineConfig | null) => void;
  setSkillConfig: (skill: AIBacktestSkill | null) => void;
  setSkillVersion: (v: number | ((prev: number) => number)) => void;
  setLastAutoBacktestAt: (at: string | null) => void;
  setActiveMethodologies: (m: MethodologyName[] | ((prev: MethodologyName[]) => MethodologyName[])) => void;
  setMethodologyWeights: (w: MethodologyWeights | ((prev: MethodologyWeights) => MethodologyWeights)) => void;
  setShowMethodologyConfig: (show: boolean | ((prev: boolean) => boolean)) => void;
  setLlmEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setLlmThreshold: (threshold: number | ((prev: number) => number)) => void;
  setLlmMinProviders: (min: number | ((prev: number) => number)) => void;
  setLlmProviderTimeoutMs: (timeout: number | ((prev: number) => number)) => void;
  setAgentConsensusEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setAgentConsensusThreshold: (threshold: number | ((prev: number) => number)) => void;
  setAgentConsensusDebateMode: (mode: "parallel" | "sequential" | ((prev: "parallel" | "sequential") => "parallel" | "sequential")) => void;
  setAgentConsensusMemoryEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setAgentConsensusToolEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setMacroNewsFailSafe: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setIsSavingSettings: (saving: boolean) => void;
  setCircuitBreaker: (state: string, reason?: string | null) => void;
  resetCircuitBreaker: () => void;
  setShowContributionIndicators: (show: boolean | ((prev: boolean) => boolean)) => void;
  setShowConsensusPanelByDefault: (show: boolean | ((prev: boolean) => boolean)) => void;
  setVisualizationStyle: (style: "radar" | "cards" | "table" | ((prev: "radar" | "cards" | "table") => "radar" | "cards" | "table")) => void;
  setIsConsensusPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  savedPipelineConfig: null,
  skillConfig: null,
  skillVersion: 0,
  lastAutoBacktestAt: null,
  activeMethodologies: [],
  methodologyWeights: { ...DEFAULT_METHODOLOGY_WEIGHTS },
  showMethodologyConfig: false,
  llmEnabled: false,
  llmThreshold: 0.7,
  llmMinProviders: 3,
  llmProviderTimeoutMs: 25000,
  agentConsensusEnabled: false,
  agentConsensusThreshold: 0.6,
  agentConsensusDebateMode: "parallel",
  agentConsensusMemoryEnabled: true,
  agentConsensusToolEnabled: true,
  macroNewsFailSafe: false,
  isSavingSettings: false,
  circuitBreakerState: "CLOSED",
  circuitBreakerReason: null,
  showContributionIndicators: true,
  showConsensusPanelByDefault: false,
  visualizationStyle: "radar",
  isConsensusPanelOpen: false,

  setSavedPipelineConfig: (savedPipelineConfig) => set({ savedPipelineConfig }),
  setSkillConfig: (skillConfig) => set({ skillConfig }),
  setSkillVersion: (v) => set((s) => ({ skillVersion: typeof v === "function" ? v(s.skillVersion) : v })),
  setLastAutoBacktestAt: (lastAutoBacktestAt) => set({ lastAutoBacktestAt }),
  setActiveMethodologies: (m) => set((s) => ({ activeMethodologies: typeof m === "function" ? m(s.activeMethodologies) : m })),
  setMethodologyWeights: (w) => set((s) => ({ methodologyWeights: typeof w === "function" ? w(s.methodologyWeights) : w })),
  setShowMethodologyConfig: (show) => set((s) => ({ showMethodologyConfig: typeof show === "function" ? show(s.showMethodologyConfig) : show })),
  setLlmEnabled: (enabled) => set((s) => ({ llmEnabled: typeof enabled === "function" ? enabled(s.llmEnabled) : enabled })),
  setLlmThreshold: (threshold) => set((s) => ({ llmThreshold: typeof threshold === "function" ? threshold(s.llmThreshold) : threshold })),
  setLlmMinProviders: (min) => set((s) => ({ llmMinProviders: typeof min === "function" ? min(s.llmMinProviders) : min })),
  setLlmProviderTimeoutMs: (timeout) => set((s) => ({ llmProviderTimeoutMs: typeof timeout === "function" ? timeout(s.llmProviderTimeoutMs) : timeout })),
  setAgentConsensusEnabled: (enabled) => set((s) => ({ agentConsensusEnabled: typeof enabled === "function" ? enabled(s.agentConsensusEnabled) : enabled })),
  setAgentConsensusThreshold: (threshold) => set((s) => ({ agentConsensusThreshold: typeof threshold === "function" ? threshold(s.agentConsensusThreshold) : threshold })),
  setAgentConsensusDebateMode: (mode) => set((s) => ({ agentConsensusDebateMode: typeof mode === "function" ? mode(s.agentConsensusDebateMode) : mode })),
  setAgentConsensusMemoryEnabled: (enabled) => set((s) => ({ agentConsensusMemoryEnabled: typeof enabled === "function" ? enabled(s.agentConsensusMemoryEnabled) : enabled })),
  setAgentConsensusToolEnabled: (enabled) => set((s) => ({ agentConsensusToolEnabled: typeof enabled === "function" ? enabled(s.agentConsensusToolEnabled) : enabled })),
  setMacroNewsFailSafe: (enabled) => set((s) => ({ macroNewsFailSafe: typeof enabled === "function" ? enabled(s.macroNewsFailSafe) : enabled })),
  setIsSavingSettings: (isSavingSettings) => set({ isSavingSettings }),
  setCircuitBreaker: (circuitBreakerState, circuitBreakerReason = null) => set({ circuitBreakerState, circuitBreakerReason }),
  resetCircuitBreaker: () => set({ circuitBreakerState: "CLOSED", circuitBreakerReason: null }),
  setShowContributionIndicators: (show) => set((s) => ({ showContributionIndicators: typeof show === "function" ? show(s.showContributionIndicators) : show })),
  setShowConsensusPanelByDefault: (show) => set((s) => ({ showConsensusPanelByDefault: typeof show === "function" ? show(s.showConsensusPanelByDefault) : show })),
  setVisualizationStyle: (style) => set((s) => ({ visualizationStyle: typeof style === "function" ? style(s.visualizationStyle) : style })),
  setIsConsensusPanelOpen: (open) => set((s) => ({ isConsensusPanelOpen: typeof open === "function" ? open(s.isConsensusPanelOpen) : open })),
}));
