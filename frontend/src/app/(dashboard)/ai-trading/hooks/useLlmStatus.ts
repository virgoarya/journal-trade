"use client";

import { useState, useEffect, useCallback } from "react";
import { aiTradingService } from "@/services/ai-trading.service";
import { type LlmModelNode, type LlmModelStatus } from "../types";
import { providerRegistry } from "../services/provider-registry.service";

/**
 * useLlmStatus - Single source of truth for LLM provider status.
 *
 * Components should NOT fetch `getLlmStatus()` directly.
 * Use this hook to keep state consistent across the dashboard.
 *
 * - Initial state = ALL_LLM_PROVIDERS (defaults = 'active')
 * - Backend response merges and overrides per-provider status
 * - Handles missing providers gracefully (keeps defaults)
 */
export function useLlmStatus(opts: { pollIntervalMs?: number } = {}) {
  const { pollIntervalMs = 0 } = opts;
  const [models, setModels] = useState<LlmModelNode[]>(() => {
    // Initialize from provider registry
    providerRegistry.initialize();
    return providerRegistry.getActiveProviders().map(p => ({
      name: p.name,
      label: p.label,
      model: p.model,
      status: p.status as LlmModelStatus,
    }));
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiTradingService.getLlmStatus();
      if (!res.success) {
        // soft-fail: keep defaults, surface error
        setError(res.error || "Failed to load LLM status");
        return;
      }
      const incoming = (res.data ?? []) as LlmModelNode[];
      const incomingMap = new Map(incoming.map((m) => [m.name, m]));
      // merge: registry providers + backend overrides (only matching providers)
      const baseProviders = providerRegistry.getActiveProviders().map(p => ({
        name: p.name,
        label: p.label,
        model: p.model,
        status: p.status as LlmModelStatus,
      }));
      const merged = baseProviders.map((def) => {
        const override = incomingMap.get(def.name);
        return override
          ? {
              ...def,
              status: (override.status as LlmModelStatus) ?? def.status,
            }
          : def;
      });
      setModels(merged);
    } catch (e: any) {
      setError(e?.message ?? "LLM status fetch error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchStatus, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, pollIntervalMs]);

  return {
    models,
    loading,
    error,
    refresh: fetchStatus,
    activeCount: models.filter((m) => m.status === "active").length,
  };
}
