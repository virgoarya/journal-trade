"use client";

/**
 * MacroPriceChart — candlestick chart dengan overlay indikator + hover legend.
 * Spec: docs/design/macro-charting-and-palette-spec.md §3
 *
 * Engine: lightweight-charts v5
 *   pane 0 → candlestick + overlay (SMA/EMA/VWAP/BB)
 *   pane 1 → volume
 *   pane 2 → oscillator (RSI/MACD), dibuat hanya saat diaktifkan
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type MouseEventParams,
} from "lightweight-charts";
import { LineChart as LineChartIcon, RefreshCw, AlertTriangle, ChevronDown } from "lucide-react";
import {
  sma,
  ema,
  vwap,
  bollingerBands,
  rsi,
  macd,
  indicatorLabel,
  type Candle,
  type IndicatorType,
} from "@/lib/indicators";
import {
  fetchCandles,
  fetchInstruments,
  CHART_TIMEFRAMES,
  DEFAULT_INSTRUMENTS,
  DEFAULT_SYMBOL,
  DEFAULT_TIMEFRAME,
  TTL_MS,
  STALE_POLL_MS,
  PENDING_INSTRUMENT_KEY,
  type ChartTimeframe,
  type MacroInstrument,
} from "@/services/macro-candles.service";
import { useAdaptivePolling } from "@/hooks/useAdaptivePolling";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_INDICATORS: IndicatorType[] = ["SMA", "EMA", "VWAP", "BB", "RSI", "MACD"];
const OVERLAY_INDICATORS: IndicatorType[] = ["SMA", "EMA", "VWAP", "BB"];
const OSCILLATOR_INDICATORS: IndicatorType[] = ["RSI", "MACD"];

/** Warna per indikator (token Terminal Noir). */
const INDICATOR_COLOR: Record<IndicatorType, string> = {
  SMA: "#60A5FA",   // biru
  EMA: "#C084FC",   // ungu
  VWAP: "#D4AF37",  // gold
  BB: "#D4AF37",    // gold (pita)
  RSI: "#38BDF8",
  MACD: "#F472B6",
};

const DEFAULT_ACTIVE: IndicatorType[] = ["SMA", "BB"];

const VOLUME_PANE = 1;
const OSCILLATOR_PANE = 2;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Urutkan naik + buang timestamp duplikat (syarat lightweight-charts). */
function normalize(candles: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of candles) map.set(c.time, c);
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function fmtPrice(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVolume(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return String(Math.round(v));
}

/**
 * Baca simbol yang diminta Command Palette lintas halaman (sekali pakai).
 * Layout Macro Terminal menulisnya sebelum berpindah tab, karena chart di
 * tab tujuan belum ter-mount dan belum bisa menerima event.
 */
function readPendingInstrument(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_INSTRUMENT_KEY);
    if (v) {
      sessionStorage.removeItem(PENDING_INSTRUMENT_KEY);
      return v;
    }
  } catch {
    /* sessionStorage bisa diblokir (private mode) — pakai simbol default */
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function MacroPriceChart({ className }: { className?: string }) {
  // ── state ──────────────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState<string>(DEFAULT_SYMBOL);
  /** Guard: tunda fetch pertama sampai simbol dari Command Palette diterapkan. */
  const [pendingChecked, setPendingChecked] = useState(false);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>(DEFAULT_TIMEFRAME);
  const [instruments, setInstruments] = useState<readonly MacroInstrument[]>(DEFAULT_INSTRUMENTS);
  const [symbolOpen, setSymbolOpen] = useState(false);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ source: string; fromCache: boolean; stale: boolean } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [active, setActive] = useState<Set<IndicatorType>>(new Set(DEFAULT_ACTIVE));
  const [hover, setHover] = useState<{ candle: Candle; values: { label: string; value: string }[] } | null>(null);

  // ── refs ───────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlayRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const oscillatorRef = useRef<Map<IndicatorType, ISeriesApi<"Line">>>(new Map());

  /** Nilai indikator per waktu — untuk hover legend. */
  const indicatorLookupRef = useRef<Map<string, Map<number, number>>>(new Map());
  const candleLookupRef = useRef<Map<number, Candle>>(new Map());

  const activeRef = useRef(active);
  activeRef.current = active;

  // ── instrumen ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController();
    fetchInstruments(ac.signal).then(setInstruments).catch(() => void 0);
    return () => ac.abort();
  }, []);

  // ── fetch candle ───────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetchCandles(symbol, timeframe, 800);
      setCandles(normalize(res.candles));
      setMeta({ source: res.source, fromCache: res.fromCache, stale: res.stale });
      setLastUpdated(new Date());
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // Saat auto-refresh gagal, jangan timpa data yang masih valid di layar.
      if (!silent) {
        setError(e?.message ?? "Gagal memuat data chart");
        setCandles([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [symbol, timeframe]);

  // Terapkan simbol dari Command Palette (lintas halaman) SEBELUM fetch pertama,
  // supaya tidak ada fetch ganda maupun kedipan dari simbol default.
  useEffect(() => {
    const pending = readPendingInstrument();
    if (pending) setSymbol(pending);
    setPendingChecked(true);
  }, []);

  useEffect(() => {
    if (!pendingChecked) return;
    void load();
  }, [load, pendingChecked]);

  // ── listener perintah Command Palette: buka instrumen di chart ────────────
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ symbol?: string }>).detail;
      if (detail?.symbol) setSymbol(detail.symbol);
    };
    window.addEventListener("macro:open-instrument", onOpen);
    return () => window.removeEventListener("macro:open-instrument", onOpen);
  }, []);

  // ── buat chart (sekali) ────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#64748B",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(30,41,59,0.55)" },
        horzLines: { color: "rgba(30,41,59,0.55)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#D4AF37", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#D4AF37" },
        horzLine: { color: "#D4AF37", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#D4AF37" },
      },
      rightPriceScale: { borderColor: "rgba(30,41,59,0.9)", scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: "rgba(30,41,59,0.9)", timeVisible: true, secondsVisible: false, rightOffset: 4 },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });

    chartRef.current = chart;

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#39FF88",
      downColor: "#FF3864",
      borderUpColor: "#39FF88",
      borderDownColor: "#FF3864",
      wickUpColor: "#39FF88",
      wickDownColor: "#FF3864",
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // volume — pane sendiri, skala terpisah
    volumeSeriesRef.current = chart.addSeries(
      HistogramSeries,
      { priceScaleId: "volume", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false },
      VOLUME_PANE
    );
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } });

    // crosshair → hover legend
    const onMove = (param: MouseEventParams) => {
      if (param.time === undefined) {
        setHover(null);
        return;
      }
      const t = param.time as number;
      const candle = candleLookupRef.current.get(t);
      if (!candle) {
        setHover(null);
        return;
      }
      const values: { label: string; value: string }[] = [];
      for (const type of activeRef.current) {
        const series = indicatorLookupRef.current.get(type);
        const v = series?.get(t);
        if (v !== undefined) values.push({ label: type, value: fmtPrice(v) });
      }
      setHover({ candle, values });
    };
    chart.subscribeCrosshairMove(onMove);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      overlayRef.current.clear();
      oscillatorRef.current.clear();
    };
  }, []);

  // ── set data candle + volume ───────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const cs = candleSeriesRef.current;
    const vs = volumeSeriesRef.current;
    if (!chart || !cs || !vs) return;

    candleLookupRef.current = new Map(candles.map((c) => [c.time, c]));

    cs.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    vs.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(57,255,136,0.30)" : "rgba(255,56,100,0.30)",
      }))
    );

    chart.timeScale().fitContent();
  }, [candles]);

  // ── indikator: hitung nilai + pasang/lepas series ──────────────────────────
  const computed = useMemo(() => {
    if (candles.length === 0) return { lookup: new Map<string, Map<number, number>>(), lines: [] as any[] };

    const lookup = new Map<string, Map<number, number>>();
    const lines: {
      type: IndicatorType;
      label: string;
      color: string;
      pane: number;
      data: { time: UTCTimestamp; value: number }[];
      dashed?: boolean;
    }[] = [];

    for (const type of ALL_INDICATORS) {
      if (!active.has(type)) continue;
      const color = INDICATOR_COLOR[type];

      if (type === "BB") {
        const bb = bollingerBands(candles, 20, 2);
        const mid = new Map<number, number>();
        bb.forEach((p) => mid.set(p.time, p.middle));
        lookup.set("BB", mid);
        lines.push({ type, label: "BB U", color, pane: 0, data: bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.upper })), dashed: true });
        lines.push({ type, label: "BB M", color, pane: 0, data: bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.middle })) });
        lines.push({ type, label: "BB L", color, pane: 0, data: bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.lower })), dashed: true });
        continue;
      }

      const pts =
        type === "SMA" ? sma(candles, 20)
        : type === "EMA" ? ema(candles, 21)
        : type === "VWAP" ? vwap(candles)
        : type === "RSI" ? rsi(candles, 14)
        : macd(candles).map((p) => ({ time: p.time, value: p.macd }));

      const m = new Map<number, number>();
      pts.forEach((p) => m.set(p.time, p.value));
      lookup.set(type, m);

      lines.push({
        type,
        label: indicatorLabel(type, type === "EMA" ? { period: 21 } : undefined),
        color,
        pane: OSCILLATOR_INDICATORS.includes(type) ? OSCILLATOR_PANE : 0,
        data: pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      });
    }

    return { lookup, lines };
  }, [candles, active]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    indicatorLookupRef.current = computed.lookup;

    // ── overlay (pane 0) ─────────────────────────────────────────────────────
    const wanted = new Set(computed.lines.filter((l) => l.pane === 0).map((l) => l.label));
    for (const [label, series] of overlayRef.current) {
      if (!wanted.has(label)) {
        chart.removeSeries(series);
        overlayRef.current.delete(label);
      }
    }
    for (const line of computed.lines.filter((l) => l.pane === 0)) {
      let s = overlayRef.current.get(line.label);
      if (!s) {
        s = chart.addSeries(LineSeries, {
          color: line.color,
          lineWidth: 2,
          lineStyle: line.dashed ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        overlayRef.current.set(line.label, s);
      }
      s.setData(line.data);
    }

    // ── oscillator (pane 2) ──────────────────────────────────────────────────
    const oscLines = computed.lines.filter((l) => l.pane === OSCILLATOR_PANE);
    const wantedOsc = new Set(oscLines.map((l) => l.type));

    for (const [type, series] of oscillatorRef.current) {
      if (!wantedOsc.has(type)) {
        chart.removeSeries(series);
        oscillatorRef.current.delete(type);
      }
    }

    if (oscLines.length > 0) {
      // pastikan pane 2 ada
      if (chart.panes().length <= OSCILLATOR_PANE) {
        const seed = chart.addSeries(LineSeries, { color: "transparent", lastValueVisible: false, priceLineVisible: false }, OSCILLATOR_PANE);
        chart.removeSeries(seed);
      }
      for (const line of oscLines) {
        let s = oscillatorRef.current.get(line.type);
        if (!s) {
          s = chart.addSeries(
            LineSeries,
            {
              color: line.color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              crosshairMarkerVisible: false,
            },
            OSCILLATOR_PANE
          );
          oscillatorRef.current.set(line.type, s);
        }
        s.setData(line.data);
      }
      chart.panes()[OSCILLATOR_PANE]?.setHeight(90);
    } else if (chart.panes().length > OSCILLATOR_PANE) {
      // tidak ada oscillator aktif → buang pane-nya
      chart.removePane(OSCILLATOR_PANE);
    }
  }, [computed]);

  // ── toggle indikator ───────────────────────────────────────────────────────
  const toggleIndicator = useCallback((type: IndicatorType) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else {
        next.add(type);
        // RSI & MACD sama-sama di pane 2 — hanya satu pada satu waktu
        if (OSCILLATOR_INDICATORS.includes(type)) {
          OSCILLATOR_INDICATORS.forEach((o) => { if (o !== type) next.delete(o); });
        }
      }
      return next;
    });
  }, []);

  // ── auto-refresh adaptif (Fase 2.3) ────────────────────────────────────────
  // Poll sesuai TTL timeframe. Saat data stale, poll lebih agresif.
  // Otomatis pause saat tab tidak terlihat atau chart di luar viewport,
  // dan langsung refresh begitu kembali aktif.
  const stale = meta?.stale ?? false;
  useAdaptivePolling({
    ref: containerRef,
    ms: stale ? STALE_POLL_MS : (TTL_MS[timeframe] ?? 60_000),
    fn: () => { void load(true); },
    enabled: !error,
  });

  // Flash harga terakhir saat nilainya berubah (visual realtime feedback)
  const lastClose = candles.length > 0 ? candles[candles.length - 1].close : null;
  const priceFlash = useFlashOnChange(lastClose, 600);

  // ── render ─────────────────────────────────────────────────────────────────
  const selected = instruments.find((i) => i.symbol === symbol);
  // LIVE bila data segar — dari provider maupun cache yang masih dalam TTL.
  const live = !error && !loading && meta !== null && !meta.stale;

  return (
    <div className={`flex flex-col w-full glass overflow-hidden relative ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle p-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap flex items-center gap-2">
            <LineChartIcon size={14} className="text-accent-gold flex-shrink-0" /> Macro Price Chart
          </h2>
        </div>
        <div className="flex items-center gap-2" role="status">
          {error ? (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold text-data-loss bg-data-loss/10 px-2 py-0.5 rounded border border-data-loss/20 uppercase tracking-widest whitespace-nowrap">
              <AlertTriangle size={9} /> ERROR
            </span>
          ) : live ? (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold text-data-profit bg-data-profit/10 px-2 py-0.5 rounded border border-data-profit/20 uppercase tracking-widest whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-data-profit animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-medium text-text-muted bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50 animate-pulse"></span>
              {loading ? "LOADING..." : meta?.stale ? "STALE" : "CACHE"}
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap border-b border-border-subtle px-2 py-1.5">
        {/* Pemilih simbol */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSymbolOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={symbolOpen}
            className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-accent-gold border border-accent-gold/30 bg-accent-gold/10 px-2 py-1 rounded hover:bg-accent-gold/20 transition-colors"
          >
            {symbol}
            <span className="text-text-muted font-normal hidden sm:inline max-w-[140px] truncate">{selected?.name ?? ""}</span>
            <ChevronDown size={11} />
          </button>

          {symbolOpen && (
            <ul
              role="listbox"
              className="absolute z-30 mt-1 w-[248px] max-h-[260px] overflow-auto rounded border border-border-subtle bg-[#0d0d12] shadow-xl"
            >
              {instruments.map((inst) => (
                <li key={inst.symbol}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={inst.symbol === symbol}
                    onClick={() => { setSymbol(inst.symbol); setSymbolOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 text-[10px] font-mono hover:bg-white/5 transition-colors ${
                      inst.symbol === symbol ? "text-accent-gold" : "text-text-primary"
                    }`}
                  >
                    <span className="font-bold">{inst.symbol}</span>
                    <span className="text-text-muted ml-2">{inst.name}</span>
                    <span className="text-text-muted/60 ml-2 uppercase text-[8px]">{inst.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-px h-4 bg-border-subtle" />

        {/* Timeframe */}
        <div className="flex gap-0.5" role="group" aria-label="Timeframe">
          {CHART_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              aria-pressed={tf === timeframe}
              className={`text-[9px] font-mono px-1.5 py-1 rounded transition-colors ${
                tf === timeframe
                  ? "bg-accent-gold text-black font-bold"
                  : "text-text-muted hover:text-text-primary hover:bg-white/5"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border-subtle" />

        {/* Indikator */}
        <div className="flex gap-0.5 flex-wrap" role="group" aria-label="Indikator">
          {ALL_INDICATORS.map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => toggleIndicator(ind)}
              aria-pressed={active.has(ind)}
              className={`text-[9px] font-mono px-1.5 py-1 rounded border transition-colors ${
                active.has(ind)
                  ? "border-accent-gold/40 text-accent-gold bg-accent-gold/10"
                  : "border-transparent text-text-muted hover:text-text-primary hover:bg-white/5"
              }`}
            >
              {ind}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {lastClose !== null && (
            <span
              className={`text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded border border-border-subtle/60 text-text-primary transition-colors ${priceFlash}`}
              title="Harga penutupan candle terakhir"
            >
              {fmtPrice(lastClose)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Muat ulang data chart"
            className="flex items-center gap-1 text-[9px] font-mono text-text-muted hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">REFRESH</span>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-[300px]">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Hover legend */}
        {hover && (
          <div className="pointer-events-none absolute top-2 left-2 z-20 rounded border border-border-subtle bg-black/80 backdrop-blur-sm px-2.5 py-2 font-mono text-[9px] leading-[1.55] min-w-[170px]">
            <div className="flex gap-3">
              <span className="text-text-muted">O</span><span className="text-text-primary font-semibold">{fmtPrice(hover.candle.open)}</span>
              <span className="text-text-muted">H</span><span className="text-text-primary font-semibold">{fmtPrice(hover.candle.high)}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-text-muted">L</span><span className="text-text-primary font-semibold">{fmtPrice(hover.candle.low)}</span>
              <span className="text-text-muted">C</span>
              <span className={`font-semibold ${hover.candle.close >= hover.candle.open ? "text-data-profit" : "text-data-loss"}`}>
                {fmtPrice(hover.candle.close)}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-text-muted">Vol</span><span className="text-text-primary font-semibold">{fmtVolume(hover.candle.volume)}</span>
            </div>
            {hover.values.length > 0 && (
              <>
                <div className="h-px bg-border-subtle my-1" />
                {hover.values.map((v) => (
                  <div key={v.label} className="flex justify-between gap-3">
                    <span style={{ color: INDICATOR_COLOR[v.label as IndicatorType] ?? "#94A3B8" }}>{v.label}</span>
                    <span className="text-text-primary font-semibold">{v.value}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Overlay status */}
        {loading && candles.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest animate-pulse">Memuat data chart…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <AlertTriangle size={18} className="text-data-loss" />
            <span className="font-mono text-[10px] text-data-loss">{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="font-mono text-[9px] text-accent-gold border border-accent-gold/30 rounded px-2 py-1 hover:bg-accent-gold/10 transition-colors"
            >
              COBA LAGI
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-subtle px-2 py-1 font-mono text-[8px] text-text-muted uppercase tracking-wider">
        <span>
          {symbol} · {timeframe} · {candles.length} CANDLES · SRC {meta?.source ?? "—"}
          {lastUpdated ? ` · UPD ${lastUpdated.toLocaleTimeString("en-GB", { hour12: false })}` : ""}
        </span>
        <span className="hidden sm:inline">HOVER = OHLC + INDIKATOR · SCROLL = ZOOM · DRAG = GESER</span>
      </div>
    </div>
  );
}

export default MacroPriceChart;
