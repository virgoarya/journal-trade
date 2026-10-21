"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  aiTradingService,
  type PipelineStatus,
  type PipelineLog,
  type MultiStrategyAnalysis,
  type LLMConsensusResult,
  type AgentConsensusResult,
} from "@/services/ai-trading.service";

/**
 * Agent Consensus (ADR-0002) is the primary path; the 6-LLM consensus is the
 * legacy fallback. Both engines expose the same card shape (`votes[]` +
 * `verdict` + `goodVotes`/`totalVotes`), so one slot carries either one.
 */
type ConsensusLike = LLMConsensusResult | AgentConsensusResult;

/** Reads `agentConsensus` first, then falls back to the legacy `llmConsensus`. */
function readConsensus(logData: any): ConsensusLike | null {
  return logData?.agentConsensus ?? logData?.llmConsensus ?? null;
}

/**
 * usePipelineData - Unified pipeline state management.
 *
 * Consolidates:
 * - Pipeline status
 * - Logs
 * - Last analysis
 * - Consensus votes (Agent Consensus first, 6-LLM as legacy fallback)
 *
 * Components should NOT fetch `getPipelineStatus()` or `getPipelineLogs()` directly.
 */
export function usePipelineData(opts: { pollIntervalMs?: number } = {}) {
  const { pollIntervalMs = 2000 } = opts;
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<MultiStrategyAnalysis | null>(null);
  const [lastLLMVotes, setLastLLMVotes] = useState<ConsensusLike | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const isFirstLoadRef = useRef(true);

  const fetchData = useCallback(async (opts?: { showLoading?: boolean }) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (opts?.showLoading ?? isFirstLoadRef.current) {
      setLoading(true);
    }
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
        // Extract latest consensus from CONFLUENCE logs — Agent Consensus
        // (ADR-0002) first, 6-LLM consensus as the legacy fallback.
        const consensusLogs = logsRes.data.logs.filter(
          (l: PipelineLog) => l.type === "CONFLUENCE" && readConsensus(l.data),
        );
        if (consensusLogs.length > 0) {
          const latest = readConsensus(consensusLogs[consensusLogs.length - 1].data);
          if (latest?.votes) setLastLLMVotes(latest);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Pipeline data fetch error");
    } finally {
      inFlightRef.current = false;
      isFirstLoadRef.current = false;
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
    refresh: () => fetchData({ showLoading: true }),
  };
}
