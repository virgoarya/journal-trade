"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, HistogramData, LineData, LineStyle, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";
import type { Candle, Timeframe } from "../hooks/useMarketReplay";
import { Play, Pause, CircleStop as Stop, SkipBack, SkipForward, FastForward, RotateCcw, Zap } from "lucide-react";

interface TradingChartProps {
  candles: Candle[];
  currentIndex: number;
  totalCandles: number;
  isPlaying: boolean;
  speed: number;
  symbol: string;
  timeframe: Timeframe;
  onCandleClick?: (candle: Candle, index: number) => void;
  indicators?: {
    sma?: { period: number; color: string }[];
    ema?: { period: number; color: string }[];
    volume?: boolean;
  };
  signals?: Array<{
    time: number;
    type: "buy" | "sell";
    price: number;
    label?: string;
  }>;
  height?: number;
}

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M1: "1m", M5: "5m", M15: "15m", M30: "30m",
  H1: "1h", H4: "4h", D1: "1D"
};

const SPEED_LABELS: Record<number, string> = {
  1: "1x", 2: "2x", 5: "5x", 10: "10x", 20: "20x", 50: "50x"
};

export function TradingChart({
  candles,
  currentIndex,
  totalCandles,
  isPlaying,
  speed,
  symbol,
  timeframe,
  onCandleClick,
  indicators = {},
  signals = [],
  height = 500,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const smaSeriesRefs = useRef<Map<number, ISeriesApi<"Line">>>(new Map());
  const emaSeriesRefs = useRef<Map<number, ISeriesApi<"Line">>>(new Map());
  const [isReady, setIsReady] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: "solid" as ColorType, color: "#0A0A0F" },
        textColor: "#D4D4D8",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1E1E2E" },
        horzLines: { color: "#1E1E2E" },
      },
      crosshair: {
        mode: 1, // Normal
        vertLine: { color: "#D4AF37", width: 1, style: 2, labelBackgroundColor: "#D4AF37" },
        horzLine: { color: "#D4AF37", width: 1, style: 2, labelBackgroundColor: "#D4AF37" },
      },
      rightPriceScale: {
        borderColor: "#2A2A3E",
        scaleMargins: { top: 0.1, bottom: 0.3 },
        autoScale: true,
      },
      timeScale: {
        borderColor: "#2A2A3E",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: true,
        rightOffset: 12,
        barSpacing: 10,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
    });

    // Main candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#39FF88",
      downColor: "#FF385C",
      borderUpColor: "#39FF88",
      borderDownColor: "#FF385C",
      wickUpColor: "#39FF88",
      wickDownColor: "#FF385C",
      priceScaleId: "right",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    // Volume series (bottom pane)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#D4AF37/50",
      priceFormat: { type: "volume" },
    });

    // Configure volume pane
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
      borderVisible: false,
      autoScale: true,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Set data
    updateCandleData();
    updateVolumeData();
    updateIndicators();
    updateSignals();

    setIsReady(true);

    // Click handler
    const handleClick = (param: any) => {
      if (param.time && onCandleClick) {
        const index = candles.findIndex(c => c.time === param.time);
        if (index >= 0) onCandleClick(candles[index], index);
      }
    };
    chart.subscribeClick(handleClick);

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      chart.unsubscribeClick(handleClick);
      resizeObserver.disconnect();
      // Cleanup series
      smaSeriesRefs.current.forEach(series => chart.removeSeries(series));
      emaSeriesRefs.current.forEach(series => chart.removeSeries(series));
      smaSeriesRefs.current.clear();
      emaSeriesRefs.current.clear();
      chart.removeSeries(candleSeries);
      chart.removeSeries(volumeSeries);
      chartRef.current = null;
    };
  }, []);

  // Convert candles to lightweight-charts format
  const chartCandles = useMemo(() => {
    return candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
  }, [candles]);

  const chartVolume = useMemo(() => {
    return candles.map(c => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? "#39FF88/50" : "#FF385C/50",
    }));
  }, [candles]);

  // Update functions
  const updateCandleData = useCallback(() => {
    if (!candleSeriesRef.current) return;
    candleSeriesRef.current.setData(chartCandles);
  }, [chartCandles]);

  const updateVolumeData = useCallback(() => {
    if (!volumeSeriesRef.current) return;
    volumeSeriesRef.current.setData(chartVolume);
  }, [chartVolume]);

  const updateIndicators = useCallback(() => {
    if (!chartRef.current) return;

    // Cleanup old series
    smaSeriesRefs.current.forEach(series => chartRef.current!.removeSeries(series));
    emaSeriesRefs.current.forEach(series => chartRef.current!.removeSeries(series));
    smaSeriesRefs.current.clear();
    emaSeriesRefs.current.clear();

    // Add SMA
    indicators.sma?.forEach(({ period, color }) => {
      const smaData = calculateSMA(chartCandles, period);
      const series = chartRef.current!.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceScaleId: "right",
        lineStyle: LineStyle.Solid,
      });
      series.setData(smaData);
      smaSeriesRefs.current.set(period, series);
    });

    // Add EMA
    indicators.ema?.forEach(({ period, color }) => {
      const emaData = calculateEMA(chartCandles, period);
      const series = chartRef.current!.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceScaleId: "right",
        lineStyle: LineStyle.Dotted,
      });
      series.setData(emaData);
      emaSeriesRefs.current.set(period, series);
    });
  }, [chartCandles, indicators]);

  const updateSignals = useCallback(() => {
    if (!candleSeriesRef.current) return;

    const markers = signals.map(s => ({
      time: s.time as Time,
      position: s.type === "buy" ? "belowBar" : "aboveBar" as const,
      shape: s.type === "buy" ? "arrowUp" : "arrowDown" as const,
      color: s.type === "buy" ? "#39FF88" : "#FF385C",
      text: s.label || (s.type === "buy" ? "BUY" : "SELL"),
    }));

    (candleSeriesRef.current as any).setMarkers(markers);
  }, [signals]);

  // Sync data when candles change
  useEffect(() => {
    if (!isReady) return;
    updateCandleData();
    updateVolumeData();
  }, [chartCandles, chartVolume, isReady, updateCandleData, updateVolumeData]);

  // Sync indicators
  useEffect(() => {
    if (!isReady) return;
    updateIndicators();
  }, [indicators, isReady, updateIndicators]);

  // Sync signals
  useEffect(() => {
    if (!isReady) return;
    updateSignals();
  }, [signals, isReady, updateSignals]);

  // Highlight current candle during replay
  useEffect(() => {
    if (!isReady || !chartRef.current || currentIndex < 0) return;

    // Scroll to current candle if playing
    if (isPlaying && currentIndex > 0) {
      const time = chartCandles[currentIndex]?.time;
      if (time) {
        chartRef.current.timeScale().scrollToPosition(currentIndex, false);
      }
    }
  }, [currentIndex, isPlaying, chartCandles, isReady]);

  // Compute time props for ReplayControls
  const currentTime = currentIndex >= 0 ? chartCandles[currentIndex]?.time : null;
  const startTime = chartCandles[0]?.time ?? null;
  const endTime = chartCandles[chartCandles.length - 1]?.time ?? null;

  if (!containerRef.current) return null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-0 flex flex-col"
      style={{ height }}
      data-symbol={symbol}
      data-timeframe={timeframe}
    >
      {/* Chart */}
      <div className="flex-1 min-h-0" />

      {/* Replay Controls */}
      <ReplayControls
        isPlaying={isPlaying}
        speed={speed}
        currentIndex={currentIndex}
        totalCandles={totalCandles}
        progress={(currentIndex + 1) / totalCandles}
        currentTime={currentTime ? Number(currentTime) : null}
        startTime={startTime ? Number(startTime) : null}
        endTime={endTime ? Number(endTime) : null}
        onPlay={() => {}}
        onPause={() => {}}
        onStop={() => {}}
        onStepBack={() => {}}
        onStepForward={() => {}}
        onSpeedChange={() => {}}
        onJumpTo={() => {}}
      />
    </div>
  );
}

// Technical indicator calculations
// Technical indicator calculations - using LineData type for indicators
function calculateSMA(candles: CandlestickData[], period: number): LineData[] {
  const result: LineData[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    result.push({ time: candles[i].time, value: sum / period });
  }
  return result;
}

function calculateEMA(candles: CandlestickData[], period: number): LineData[] {
  const result: LineData[] = [];
  const multiplier = 2 / (period + 1);
  let ema = candles[0].close;

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      ema = candles[i].close;
    } else {
      ema = (candles[i].close - ema) * multiplier + ema;
    }
    if (i >= period - 1) {
      result.push({ time: candles[i].time, value: ema });
    }
  }
  return result;
}

// ============================================================================
// Replay Controls Component
// ============================================================================

interface ReplayControlsProps {
  isPlaying: boolean;
  speed: number;
  currentIndex: number;
  totalCandles: number;
  progress: number;
  currentTime: number | null; // Unix timestamp of current candle
  startTime: number | null;   // Unix timestamp of first candle
  endTime: number | null;     // Unix timestamp of last candle
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSpeedChange: (speed: number) => void;
  onJumpTo: (index: number) => void;
}

export function ReplayControls({
  isPlaying,
  speed,
  currentIndex,
  totalCandles,
  progress,
  currentTime,
  startTime,
  endTime,
  onPlay,
  onPause,
  onStop,
  onStepBack,
  onStepForward,
  onSpeedChange,
  onJumpTo,
}: ReplayControlsProps) {
  const speeds = [1, 2, 5, 10, 20, 50];

  return (
    <div className="glass p-4 border border-accent-gold/20 space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-text-muted">REPLAY PROGRESS</span>
          <span className="text-accent-gold">{Math.round(progress * 100)}%</span>
        </div>
        <div className="relative h-2 bg-black/50 rounded-full overflow-hidden border border-accent-gold/20">
          <div
            className="h-full bg-gradient-to-r from-accent-gold/50 to-accent-gold rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Draggable handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent-gold rounded-full border-2 border-black shadow-lg opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ left: `${progress * 100}%`, transform: `translate(-50%, -50%)` }}
            onMouseDown={(e) => {
              e.preventDefault();
              const handleDrag = (moveEvent: MouseEvent) => {
                const rect = (e.target as HTMLElement).parentElement!.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
                const index = Math.floor(percent * totalCandles);
                onJumpTo(index);
              };
              const handleUp = () => {
                window.removeEventListener("mousemove", handleDrag);
                window.removeEventListener("mouseup", handleUp);
              };
              window.addEventListener("mousemove", handleDrag);
              window.addEventListener("mouseup", handleUp);
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-text-muted font-mono">
          <span>{startTime ? formatTimestamp(startTime) : "—"}</span>
          <span>{endTime ? formatTimestamp(endTime) : "—"}</span>
        </div>
      </div>

      {/* Time Display */}
      <div className="flex items-center justify-between text-text-primary font-mono">
        <span className="text-xs tracking-wider">
          {currentTime ? formatTimestamp(currentTime) : "—"}
        </span>
        <span className="text-[10px] text-text-muted">
          {currentIndex + 1} / {totalCandles}
        </span>
      </div>

      {/* Speed Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-text-muted">SPEED</span>
          <span className="text-accent-gold">{SPEED_LABELS[speed]}</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {speeds.map(s => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider uppercase transition-all whitespace-nowrap ${
                s === speed
                  ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/50 shadow-[0_0_8px_rgba(212,175,55,0.3)]"
                  : "bg-black/50 text-text-muted hover:text-text-primary hover:bg-black/70 border border-white/10"
              }`}
            >
              {SPEED_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-2 pt-2 border-t border-accent-gold/10">
        <button
          onClick={onStop}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-black/50 border border-neon-red/30 text-neon-red hover:bg-neon-red/10 hover:border-neon-red/50 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          disabled={currentIndex === -1 && !isPlaying}
        >
          <Stop className="w-4 h-4" />
          <span>STOP</span>
        </button>
        <button
          onClick={onStepBack}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-black/50 border border-white/10 text-text-muted hover:bg-black/70 text-[10px] font-bold uppercase tracking-wider transition-all"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        {isPlaying ? (
          <button
            onClick={onPause}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-black/50 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/50 text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            <Pause className="w-4 h-4" />
            <span>PAUSE</span>
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-accent-gold/10 border border-accent-gold/40 text-accent-gold hover:bg-accent-gold/20 hover:shadow-[0_0_12px_rgba(212,175,55,0.4)] text-[10px] font-bold uppercase tracking-wider transition-all shadow-[0_0_8px_rgba(212,175,55,0.2)]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>PLAY</span>
          </button>
        )}
        <button
          onClick={onStepForward}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-black/50 border border-white/10 text-text-muted hover:bg-black/70 text-[10px] font-bold uppercase tracking-wider transition-all"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Live/Replay Badge */}
      <div className="flex items-center justify-center gap-2 text-[9px] font-mono uppercase tracking-widest">
        <span className={`px-2 py-0.5 rounded border ${
          isPlaying ? "bg-accent-gold/20 text-accent-gold border-accent-gold/50 animate-pulse shadow-[0_0_8px_rgba(212,175,55,0.3)]"
          : "bg-black/50 text-text-muted border-white/10"
        }`}>
          {isPlaying ? "REPLAYING" : "PAUSED"}
        </span>
        <span className="text-text-muted">MODE</span>
      </div>
    </div>
  );
}

// Helper functions
function formatTimestamp(time?: number | Time): string {
  if (!time) return "—";
  const date = typeof time === "number" ? new Date(time * 1000) : new Date(time as string);
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}