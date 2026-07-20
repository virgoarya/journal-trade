"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  aiTradingService,
  type PipelineConfig,
  type PipelineStatus,
  type PipelineLog,
  type MultiStrategyAnalysis,
  type LLMConsensusResult,
} from "@/services/ai-trading.service";
import { toast } from "sonner";

export function usePipeline() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<MultiStrategyAnalysis | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [lastLLMVotes, setLastLLMVotes] = useState<LLMConsensusResult | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(async (config: PipelineConfig) => {
    setIsStarting(true);
    try {
      const result = await aiTradingService.startPipeline(config);
      if (result.success) {
        // Immediately set status so polling useEffect kicks in
        setStatus({
          running: true,
          paused: false,
          startedAt: new Date().toISOString(),
          config,
          metrics: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            dailyPnL: 0,
            openPositions: 0,
            currentDrawdown: 0,
          },
          lastSignal: null,
          lastAnalysis: null,
          lastError: null,
        });
        toast.success("AI Trading Pipeline started");
        return true;
      } else {
        toast.error(result.error || "Failed to start pipeline");
        return false;
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start pipeline");
      return false;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setIsStopping(true);
    try {
      await aiTradingService.stopPipeline();
      toast.success("Pipeline stopped");
    } catch (e: any) {
      toast.error(e.message || "Failed to stop pipeline");
    } finally {
      setIsStopping(false);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await aiTradingService.pausePipeline();
      toast.success("Pipeline paused");
    } catch (e: any) {
      toast.error(e.message || "Failed to pause");
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      await aiTradingService.resumePipeline();
      toast.success("Pipeline resumed");
    } catch (e: any) {
      toast.error(e.message || "Failed to resume");
    }
  }, []);

  // Poll status & logs while running
  useEffect(() => {
    if (status?.running) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await aiTradingService.getPipelineStatusWithLogs(100);
          if (res.success && res.data) {
            setStatus(res.data.status);
            if (res.data.status.lastAnalysis) {
              setLastAnalysis(res.data.status.lastAnalysis);
            }
            setLogs(res.data.logs);
            // Extract latest LLM consensus from CONFLUENCE logs
            const llmLogs = res.data.logs.filter(
              (l: PipelineLog) => l.type === "CONFLUENCE" && (l.data as any)?.llmConsensus,
            );
            if (llmLogs.length > 0) {
              const latest = (llmLogs[llmLogs.length - 1].data as any).llmConsensus as LLMConsensusResult;
              if (latest?.votes) setLastLLMVotes(latest);
            }
          }
        } catch {
          // ignore
        }
      }, 2000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [status?.running]);

  // Initial fetch
  const refresh = useCallback(async () => {
    try {
      const res = await aiTradingService.getPipelineStatusWithLogs(100);
      if (res.success && res.data) {
        setStatus(res.data.status);
        if (res.data.status.lastAnalysis) {
          setLastAnalysis(res.data.status.lastAnalysis);
        }
        setLogs(res.data.logs);
        const llmLogs = res.data.logs.filter(
          (l: PipelineLog) => l.type === "CONFLUENCE" && (l.data as any)?.llmConsensus,
        );
        if (llmLogs.length > 0) {
          const latest = (llmLogs[llmLogs.length - 1].data as any).llmConsensus as LLMConsensusResult;
          if (latest?.votes) setLastLLMVotes(latest);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    status,
    lastAnalysis,
    logs,
    isStarting,
    isStopping,
    lastLLMVotes,
    start,
    stop,
    pause,
    resume,
    refresh,
  };
}
