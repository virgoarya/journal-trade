"use client";

import { LlmProviderConfig, MODEL_COLORS } from "../types";
import { ALL_LLM_PROVIDERS } from "../types";

/**
 * Default providers to use when no user providers are configured
 */
const DEFAULT_PROVIDERS: LlmProviderConfig[] = [
  { name: "deepseek", label: "DeepSeek V4", model: "deepseek-v4", color: MODEL_COLORS.deepseek, status: "active" },
  { name: "qwen", label: "Qwen 3 32B", model: "qwen3.5-32b-chat", color: MODEL_COLORS.qwen, status: "active" },
  { name: "gemini", label: "Gemini 2.5 Flash", model: "gemini-2.5-flash", color: MODEL_COLORS.gemini, status: "active" },
  { name: "mistral", label: "Mistral Large", model: "mistral-large-2402", color: MODEL_COLORS.mistral, status: "active" },
  { name: "nemotron", label: "Nemotron 3 Ultra", model: "nemotron-4-340b-instruct", color: MODEL_COLORS.nemotron, status: "active" },
  { name: "claude-opus", label: "Claude Opus 4.6", model: "claude-3-opus-20240229", color: MODEL_COLORS["claude-opus"], status: "active" },
];

/**
 * ProviderRegistry - Singleton registry for managing LLM providers dynamically.
 *
 * Features:
 * - Register new providers at runtime
 * - Enable/disable providers without code changes
 * - Persist provider configurations in localStorage
 * - Provide clean API for components to query providers
 */
class ProviderRegistryService {
  private providers: Map<string, LlmProviderConfig> = new Map();
  private readonly STORAGE_KEY = "ai-trading-providers";
  private initialized = false;

  /**
   * Initialize registry with default or saved providers
   */
  initialize() {
    if (this.initialized) return;

    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed: LlmProviderConfig[] = JSON.parse(stored);
        parsed.forEach((p) => this.providers.set(p.name, p));
      } else {
        // Load defaults
        DEFAULT_PROVIDERS.forEach((p) => this.providers.set(p.name, p));
      }
    } catch {
      // Fallback to defaults on error
      DEFAULT_PROVIDERS.forEach((p) => this.providers.set(p.name, p));
    }

    this.initialized = true;
  }

  /**
   * Get all registered providers
   */
  getProviders(): LlmProviderConfig[] {
    if (!this.initialized) this.initialize();
    return Array.from(this.providers.values());
  }

  /**
   * Get active providers only
   */
  getActiveProviders(): LlmProviderConfig[] {
    return this.getProviders().filter((p) => p.status === "active");
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): LlmProviderConfig | undefined {
    if (!this.initialized) this.initialize();
    return this.providers.get(name);
  }

  /**
   * Register a new provider
   */
  registerProvider(config: LlmProviderConfig): boolean {
    if (!this.initialized) this.initialize();

    if (this.providers.has(config.name)) {
      return false; // Already exists
    }

    this.providers.set(config.name, config);
    this.persist();
    return true;
  }

  /**
   * Update an existing provider
   */
  updateProvider(name: string, updates: Partial<LlmProviderConfig>): boolean {
    if (!this.initialized) this.initialize();

    const existing = this.providers.get(name);
    if (!existing) return false;

    this.providers.set(name, { ...existing, ...updates });
    this.persist();
    return true;
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): boolean {
    if (!this.initialized) this.initialize();

    if (!this.providers.has(name)) return false;

    this.providers.delete(name);
    this.persist();
    return true;
  }

  /**
   * Check if a provider can be used for consensus
   */
  canUseProvider(name: string): boolean {
    const provider = this.getProvider(name);
    return provider?.status === "active";
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(name: string): boolean {
    if (!this.initialized) this.initialize();
    return this.providers.has(name);
  }

  /**
   * Reset to default providers
   */
  resetToDefaults() {
    this.providers.clear();
    DEFAULT_PROVIDERS.forEach((p) => this.providers.set(p.name, p));
    this.persist();
  }

  /**
   * Persist providers to localStorage
   */
  private persist() {
    try {
      const data = Array.from(this.providers.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistryService();
