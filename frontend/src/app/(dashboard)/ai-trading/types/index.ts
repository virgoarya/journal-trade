// Shared types and constants for AI Trading frontend

import type {
  MethodologyName,
  MethodologyWeights,
  LLMConsensusVote,
  LLMConsensusResult,
  ACCOUNTInfo,
  Position,
  SymbolInfo,
  Rate,
  TradingSignal,
  MultiStrategyAnalysis,
  ConfluenceResult,
  MarketStructureSummary,
  MethodologySignalResult,
  MethodologyBreakdown,
  AIBacktestSkill,
  PipelinePerformance,
  PipelineLog,
  PipelineStatus,
  PipelineConfig,
  AutoBacktestSummary,
} from "@/services/ai-trading.service";

/**
 * LLM Model status: aligned with backend `/llm-status` response
 * 'active' = provider is live and responding, 'hibernasi' = temporarily down/paused
 */
export type LlmModelStatus = "active" | "hibernasi" | "circuit_open";

/**
 * Standardized model node shape used across all components.
 * Consolidates duplicates from LLMConsensusViz.tsx and LLMProviderCard.tsx.
 */
export interface LlmModelNode {
  name: string;          // provider key: deepseek, gpt, gemini, mistral, nemotron, claude-opus
  label: string;         // human-readable name for UI
  model: string;         // model identifier used by the provider
  status: LlmModelStatus; // connection/perceived health
}

/**
 * Model color palette: consistent hue per provider across visualizations.
 * Shared between LLMConsensusViz, LLMProviderCard, and dynamic provider system.
 */
export const MODEL_COLORS: Record<string, string> = {
  deepseek: "#8B5CF6",    // violet
  gpt: "#3B82F6",        // blue
  gemini: "#10B981",      // emerald
  mistral: "#F59E0B",     // amber
  nemotron: "#EF4444",    // red
  "claude-opus": "#D4AF37", // gold
};

/**
 * Dynamic provider configuration for the LLM consensus system.
 * Enables runtime registration of providers without modifying core components.
 */
export interface LlmProviderConfig {
  name: string;
  label: string;
  model: string;
  color: string;
  logoPath?: string;
  status?: "active" | "inactive" | "hibernasi";
}

/**
 * Provider registry service interface for dynamic provider management.
 */
export interface ProviderRegistry {
  /**
   * Get all registered providers
   */
  getProviders(): LlmProviderConfig[];

  /**
   * Register a new provider
   */
  registerProvider(config: LlmProviderConfig): boolean;

  /**
   * Update an existing provider
   */
  updateProvider(name: string, updates: Partial<LlmProviderConfig>): boolean;

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): boolean;

  /**
   * Get a provider by name
   */
  getProvider(name: string): LlmProviderConfig | undefined;

  /**
   * Check if provider can be used for consensus
   */
  canUseProvider(name: string): boolean;
}

/**
 * Theme configuration for UI theming
 */
export interface ThemeConfig {
  mode: "light" | "dark";
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: "dark",
  primaryColor: "#D4AF37", // gold
  backgroundColor: "#000000", // black
  textColor: "#FFFFFF", // white
  borderColor: "#374151", // gray-700
  accentColor: "#D4AF37", // gold
};

export const LIGHT_THEME_CONFIG: ThemeConfig = {
  mode: "light",
  primaryColor: "#D4AF37", // gold
  backgroundColor: "#FFFFFF", // white
  textColor: "#000000", // black
  borderColor: "#E5E7EB", // gray-200
  accentColor: "#D4AF37", // gold
};

/**
 * Theme context interface
 */
export interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (mode: "light" | "dark") => void;
  toggleTheme: () => void;
  isSystemPreferenceDark: boolean;
}

/**
 * Verdict style definitions for status badges.
 * Covers GOOD/BAD/SKIP variants used by LLMProviderCard and others.
 */
export const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  GOOD: { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/25", label: "GOOD" },
  BAD: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/25", label: "BAD" },
  SKIP: { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/25", label: "SKIP" },
};

/**
 * All 6 LLM providers used by default for display and consensus voting.
 * Order matches the UI grid in LLMConsensusViz; kept stable for UI layout.
 */
export const ALL_LLM_PROVIDERS: LlmModelNode[] = [
  { name: "deepseek", label: "DeepSeek V4", model: "deepseek-v4", status: "active" },
  { name: "gpt", label: "GPT OSS 120B", model: "groq/openai/gpt-oss-120b", status: "active" },
  { name: "gemini", label: "Gemini 2.5 Flash", model: "gemini-2.5-flash", status: "active" },
  { name: "mistral", label: "Mistral Large", model: "mistral-large-2402", status: "active" },
  { name: "nemotron", label: "Nemotron 3 Ultra", model: "nemotron-4-340b-instruct", status: "active" },
  { name: "claude-opus", label: "Claude Opus 4.7", model: "cc/claude-opus-4-7", status: "active" },
];

/**
 * Provider logo component shape for dynamic provider system.
 */
export interface LogoProps {
  size?: number;
  className?: string;
}

export type { MethodologyName, MethodologyWeights };
export type { ACCOUNTInfo, Position, SymbolInfo, Rate, TradingSignal, PipelineLog, PipelineStatus, PipelineConfig };
export type { LLMConsensusVote, LLMConsensusResult };
export type { MultiStrategyAnalysis, ConfluenceResult, MarketStructureSummary, MethodologySignalResult, MethodologyBreakdown };
export type { AIBacktestSkill, AutoBacktestSummary, PipelinePerformance };

// Re-export methodology display config so components can import from types only
import {
  METHODOLOGY_LABELS as _METHODOLOGY_LABELS,
  METHODOLOGY_COLORS as _METHODOLOGY_COLORS,
  DEFAULT_METHODOLOGY_WEIGHTS as _DEFAULT_METHODOLOGY_WEIGHTS,
} from "@/services/ai-trading.service";

export const METHODOLOGY_LABELS = _METHODOLOGY_LABELS;
export const METHODOLOGY_COLORS = _METHODOLOGY_COLORS;
export const DEFAULT_METHODOLOGY_WEIGHTS = _DEFAULT_METHODOLOGY_WEIGHTS;
