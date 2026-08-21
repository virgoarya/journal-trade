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
  const [allAnalyses, setAllAnalyses] = useState<MultiStrategyAnalysis[]>([]);
  const [isStopping, setIsStopping] = useState(false);
  const [lastLLMVotes, setLastLLMVotes] = useState<LLMConsensusResult | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastLogTimeRef = useRef<string | null>(null);
  const consecutiveErrorsRef = useRef(0);

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
          allAnalyses: [],
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
      setStatus(prev => prev ? { ...prev, running: false, paused: false } : null);
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
      setStatus(prev => prev ? { ...prev, running: false, paused: true } : null);
      toast.success("Pipeline paused");
    } catch (e: any) {
      toast.error(e.message || "Failed to pause");
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      await aiTradingService.resumePipeline();
      setStatus(prev => prev ? { ...prev, running: true, paused: false } : null);
      toast.success("Pipeline resumed");
    } catch (e: any) {
      toast.error(e.message || "Failed to resume");
    }
  }, []);

  // Adaptive polling - faster when active, slower when idle
  const getPollInterval = useCallback(() => {
    if (!status?.running) return 0;

    // Check if there are open positions or recent activity
    const hasOpenPositions = (status.metrics?.openPositions ?? 0) > 0;
    const hasRecentSignal = status.lastSignal !== null;
    const hasRecentLogs = logs.some(l => Date.now() - new Date(l.time).getTime() < 30000);

    if (hasOpenPositions || hasRecentSignal || hasRecentLogs) {
      return 3000; // 3s when actively trading
    }
    return 8000; // 8s when idle
  }, [status?.running, status?.metrics?.openPositions, status?.lastSignal, logs]);

  // Poll status & logs while running
  useEffect(() => {
    if (!status?.running) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await aiTradingService.getPipelineStatusWithLogs(50); // Reduced from 100 to 50
        if (res.success && res.data) {
          setStatus(res.data.status);
          if (res.data.status.lastAnalysis) {
            setLastAnalysis(res.data.status.lastAnalysis);
          }
          if (res.data.status.allAnalyses) {
            setAllAnalyses(res.data.status.allAnalyses);
          }

          // Incremental log updates - only append new logs
          const incomingLogs = res.data.logs;
          if (incomingLogs.length > 0) {
            setLogs(prev => {
              const lastTime = lastLogTimeRef.current;
              if (!lastTime) {
                lastLogTimeRef.current = incomingLogs[incomingLogs.length - 1].time;
                return incomingLogs;
              }
              const newLogs = incomingLogs.filter(l => l.time > lastTime);
              if (newLogs.length > 0) {
                lastLogTimeRef.current = incomingLogs[incomingLogs.length - 1].time;
                // Keep only last 200 logs to prevent memory buildup
                const combined = [...prev, ...newLogs].slice(-200);
                return combined;
              }
              return prev;
            });
          }

          // Extract latest LLM consensus from CONFLUENCE logs
          const llmLogs = res.data.logs.filter(
            (l: PipelineLog) => l.type === "CONFLUENCE" && (l.data as any)?.llmConsensus,
          );
          if (llmLogs.length > 0) {
            const latest = (llmLogs[llmLogs.length - 1].data as any).llmConsensus as LLMConsensusResult;
            if (latest?.votes) setLastLLMVotes(latest);
          }

          consecutiveErrorsRef.current = 0;
        }
      } catch (error) {
        consecutiveErrorsRef.current++;
        // Exponential backoff on errors: 3s, 6s, 12s, 24s, max 60s
        const backoffMs = Math.min(3000 * Math.pow(2, consecutiveErrorsRef.current - 1), 60000);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = setTimeout(poll, backoffMs);
        }
        return;
      }
    };

    // Initial immediate poll
    poll();

    // Set up recurring poll with adaptive interval
    const scheduleNext = () => {
      const interval = getPollInterval();
      if (interval > 0) {
        pollRef.current = setTimeout(() => {
          poll();
          scheduleNext();
        }, interval);
      }
    };
    scheduleNext();

    return () => {
      if (pollRef.current) {
        if (typeof pollRef.current === 'object' && 'clearTimeout' in pollRef.current) {
          clearTimeout(pollRef.current as any);
        } else {
          clearInterval(pollRef.current as any);
        }
        pollRef.current = null;
      }
    };
  }, [status?.running, getPollInterval]);

  // Initial fetch
  const refresh = useCallback(async () => {
    try {
      const res = await aiTradingService.getPipelineStatusWithLogs(100);
      if (res.success && res.data) {
        setStatus(res.data.status);
        if (res.data.status.lastAnalysis) {
          setLastAnalysis(res.data.status.lastAnalysis);
        }
        if (res.data.status.allAnalyses) {
          setAllAnalyses(res.data.status.allAnalyses);
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
    allAnalyses,
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
