"use client";

import { useState, useEffect, useCallback } from "react";
import {
  aiTradingService,
  type PipelineStatus,
  type PipelineLog,
  type MultiStrategyAnalysis,
  type LLMConsensusResult,
} from "@/services/ai-trading.service";

/**
 * usePipelineData - Unified pipeline state management.
 *
 * Consolidates:
 * - Pipeline status
 * - Logs
 * - Last analysis
 * - LLM consensus votes
 *
 * Components should NOT fetch `getPipelineStatus()` or `getPipelineLogs()` directly.
 */
export function usePipelineData(opts: { pollIntervalMs?: number } = {}) {
  const { pollIntervalMs = 2000 } = opts;
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<MultiStrategyAnalysis | null>(null);
  const [lastLLMVotes, setLastLLMVotes] = useState<LLMConsensusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, logsRes] = await Promise.all([
        aiTradingService.getPipelineStatus(),
        aiTradingService.getPipelineLogs(100),
      ]);

      if (statusRes.success && statusRes.data) {
        setStatus(statusRes.data);
        if (statusRes.data.lastAnalysis) {
          setLastAnalysis(statusRes.data.lastAnalysis);
        }
      }

      if (logsRes.success && logsRes.data) {
        setLogs(logsRes.data.logs);
        // Extract latest LLM consensus from CONFLUENCE logs
        const llmLogs = logsRes.data.logs.filter(
          (l: PipelineLog) => l.type === "CONFLUENCE" && (l.data as any)?.llmConsensus,
        );
        if (llmLogs.length > 0) {
          const latest = (llmLogs[llmLogs.length - 1].data as any).llmConsensus as LLMConsensusResult;
          if (latest?.votes) setLastLLMVotes(latest);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Pipeline data fetch error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchData, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchData, pollIntervalMs]);

  return {
    status,
    logs,
    lastAnalysis,
    lastLLMVotes,
    loading,
    error,
    refresh: fetchData,
  };
}
