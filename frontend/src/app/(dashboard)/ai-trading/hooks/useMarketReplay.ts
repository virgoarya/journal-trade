"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { aiTradingService } from "@/services/ai-trading.service";

export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";

export interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ReplayState {
  candles: Candle[];
  currentIndex: number;
  isPlaying: boolean;
  speed: number; // 1x, 2x, 5x, 10x, 20x
  symbol: string;
  timeframe: Timeframe;
  totalCandles: number;
}

export interface UseMarketReplayReturn {
  // State
  state: ReplayState;
  currentCandle: Candle | null;
  historicalCandles: Candle[];
  progress: number; // 0-1

  // Controls
  loadHistory: (symbol: string, timeframe: Timeframe, from: number, to: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  jumpTo: (index: number) => void;
  jumpToTime: (timestamp: number) => void;
  stepForward: () => void;
  stepBackward: () => void;

  // Strategy integration
  runStrategyOnCurrent: () => Promise<any>;
  subscribeToCandleClose: (callback: (candle: Candle, historicalCandles: Candle[]) => void) => () => void;

  // Utils
  getCandleAt: (index: number) => Candle | undefined;
  getTimeRange: () => { from: number; to: number } | null;
}

const SPEED_OPTIONS = [1, 2, 5, 10, 20, 50];

export function useMarketReplay(): UseMarketReplayReturn {
  const [state, setState] = useState<ReplayState>({
    candles: [],
    currentIndex: -1,
    isPlaying: false,
    speed: 1,
    symbol: "XAUUSD",
    timeframe: "M15",
    totalCandles: 0,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const candleCloseCallbacks = useRef<Set<(candle: Candle, historicalCandles: Candle[]) => void>>(new Set());

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Replay loop
  useEffect(() => {
    if (!state.isPlaying || state.candles.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const intervalMs = 1000 / state.speed;
    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.currentIndex >= prev.candles.length - 1) {
          // Reached end - pause
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return { ...prev, isPlaying: false };
        }
        const newIndex = prev.currentIndex + 1;
        const candle = prev.candles[newIndex];

        // Fire candle close callbacks
        const historical = prev.candles.slice(0, newIndex + 1);
        candleCloseCallbacks.current.forEach((cb) => cb(candle, historical));

        return { ...prev, currentIndex: newIndex };
      });
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isPlaying, state.speed, state.candles.length]);

  // Derived state
  const currentCandle = state.currentIndex >= 0 ? state.candles[state.currentIndex] : null;
  const historicalCandles = state.candles.slice(0, state.currentIndex + 1);
  const progress = state.totalCandles > 0 ? (state.currentIndex + 1) / state.totalCandles : 0;

  // Load historical data from MT5
  const loadHistory = useCallback(async (
    symbol: string,
    timeframe: Timeframe,
    from: number,
    to: number
  ) => {
    try {
      const result = await aiTradingService.getRatesRange(symbol, timeframe, from, to);

      if (result.success && result.data && result.data.rates && Array.isArray(result.data.rates)) {
        const candles: Candle[] = result.data.rates.map((r: any) => ({
          time: r.time || r.timestamp || Math.floor(Date.now() / 1000),
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: Number(r.volume || r.tick_volume || 0),
        }));

        setState((prev) => ({
          ...prev,
          candles,
          currentIndex: -1, // Start before first candle
          symbol,
          timeframe,
          totalCandles: candles.length,
          isPlaying: false,
        }));
      } else {
        throw new Error(result.error || "Failed to load rates");
      }
    } catch (error) {
      console.error("[useMarketReplay] Failed to load history:", error);
      throw error;
    }
  }, []);

  // Controls
  const play = useCallback(() => {
    setState((prev) => {
      if (prev.candles.length === 0) return prev;
      if (prev.currentIndex >= prev.candles.length - 1) {
        // Restart from beginning
        return { ...prev, currentIndex: -1, isPlaying: true };
      }
      return { ...prev, isPlaying: true };
    });
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    setState((prev) => ({ ...prev, currentIndex: -1, isPlaying: false }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    if (!SPEED_OPTIONS.includes(speed)) return;
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const jumpTo = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(-1, Math.min(index, prev.candles.length - 1)),
      isPlaying: false,
    }));
  }, []);

  const jumpToTime = useCallback((timestamp: number) => {
    setState((prev) => {
      const index = prev.candles.findIndex((c) => c.time >= timestamp);
      return {
        ...prev,
        currentIndex: index >= 0 ? index : prev.candles.length - 1,
        isPlaying: false,
      };
    });
  }, []);

  const stepForward = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.currentIndex + 1, prev.candles.length - 1),
      isPlaying: false,
    }));
  }, []);

  const stepBackward = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(prev.currentIndex - 1, -1),
      isPlaying: false,
    }));
  }, []);

  // Strategy integration
  const runStrategyOnCurrent = useCallback(async () => {
    if (!currentCandle) return null;

    // Call backend pipeline with historical data up to current candle
    // This would integrate with trading-pipeline.service.ts
    return { candle: currentCandle, historical: historicalCandles };
  }, [currentCandle, historicalCandles]);

  const subscribeToCandleClose = useCallback((
    callback: (candle: Candle, historicalCandles: Candle[]) => void
  ) => {
    candleCloseCallbacks.current.add(callback);
    return () => {
      candleCloseCallbacks.current.delete(callback);
    };
  }, []);

  const getCandleAt = useCallback((index: number) => {
    return state.candles[index];
  }, [state.candles]);

  const getTimeRange = useCallback(() => {
    if (state.candles.length === 0) return null;
    return {
      from: state.candles[0].time,
      to: state.candles[state.candles.length - 1].time,
    };
  }, [state.candles]);

  return {
    state,
    currentCandle,
    historicalCandles,
    progress,
    loadHistory,
    play,
    pause,
    stop,
    setSpeed,
    jumpTo,
    jumpToTime,
    stepForward,
    stepBackward,
    runStrategyOnCurrent,
    subscribeToCandleClose,
    getCandleAt,
    getTimeRange,
  };
}