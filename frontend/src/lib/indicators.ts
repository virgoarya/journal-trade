/**
 * Macro Terminal — Technical Indicators
 *
 * Fungsi MURNI (pure) untuk kalkulasi indikator chart.
 * Semua fungsi menerima `Candle[]` dan mengembalikan array yang **sejajar** dengan
 * input: hanya titik yang nilainya sudah terdefinisi (warm-up period dilewati).
 *
 * Spec: docs/design/macro-charting-and-palette-spec.md §3.4
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Candle {
  /** Unix timestamp (detik) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export type IndicatorType = "SMA" | "EMA" | "VWAP" | "BB" | "RSI" | "MACD";

export interface IndicatorParams {
  period?: number;
  bbPeriod?: number;
  bbStdDev?: number;
  rsiPeriod?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
}

export const DEFAULT_INDICATOR_PARAMS: Required<IndicatorParams> = {
  period: 20,
  bbPeriod: 20,
  bbStdDev: 2,
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EMA atas deret angka mentah. Mengembalikan array sepanjang `values`
 * dengan `null` untuk indeks warm-up (sebelum seed tersedia).
 *
 * Seed = SMA(period) pada indeks `period - 1`, lalu:
 *   EMA[i] = value[i] * k + EMA[i-1] * (1 - k),  k = 2 / (period + 1)
 */
function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period < 1 || values.length < period) return out;

  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  seed /= period;

  out[period - 1] = seed;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + (out[i - 1] as number) * (1 - k);
  }
  return out;
}

/** Validasi ringan: buang candle dengan harga non-finite. */
function sanitize(candles: Candle[]): Candle[] {
  return candles.filter(
    (c) =>
      Number.isFinite(c.close) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.volume)
  );
}

/** Gabungkan array nilai (dengan null) + candle menjadi IndicatorPoint[]. */
function toPoints(candles: Candle[], values: (number | null)[]): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = values[i];
    if (v !== null && Number.isFinite(v)) out.push({ time: candles[i].time, value: v });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMA — Simple Moving Average
//   SMA(n)[i] = mean(close[i-n+1 .. i])
// ─────────────────────────────────────────────────────────────────────────────

export function sma(candles: Candle[], period = DEFAULT_INDICATOR_PARAMS.period): IndicatorPoint[] {
  const data = sanitize(candles);
  const out: (number | null)[] = new Array(data.length).fill(null);
  if (period < 1 || data.length < period) return [];

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) out[i] = sum / period;
  }
  return toPoints(data, out);
}

// ─────────────────────────────────────────────────────────────────────────────
// EMA — Exponential Moving Average
// ─────────────────────────────────────────────────────────────────────────────

export function ema(candles: Candle[], period = DEFAULT_INDICATOR_PARAMS.period): IndicatorPoint[] {
  const data = sanitize(candles);
  return toPoints(data, emaSeries(data.map((c) => c.close), period));
}

// ─────────────────────────────────────────────────────────────────────────────
// VWAP — Volume Weighted Average Price
//   VWAP[i] = Σ(typicalPrice * volume) / Σ(volume),  typical = (H + L + C) / 3
//   Kumulatif sepanjang seri yang diberikan (tanpa reset sesi).
// ─────────────────────────────────────────────────────────────────────────────

export function vwap(candles: Candle[]): IndicatorPoint[] {
  const data = sanitize(candles);
  const out: (number | null)[] = new Array(data.length).fill(null);

  let pvSum = 0;
  let volSum = 0;
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const typical = (c.high + c.low + c.close) / 3;
    pvSum += typical * c.volume;
    volSum += c.volume;
    if (volSum > 0) out[i] = pvSum / volSum;
  }
  return toPoints(data, out);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bollinger Bands
//   middle = SMA(period)
//   upper  = middle + stdDev * σ    lower = middle - stdDev * σ
//   σ = simpangan baku populasi pada window
// ─────────────────────────────────────────────────────────────────────────────

export function bollingerBands(
  candles: Candle[],
  period = DEFAULT_INDICATOR_PARAMS.bbPeriod,
  stdDev = DEFAULT_INDICATOR_PARAMS.bbStdDev
): BollingerPoint[] {
  const data = sanitize(candles);
  const out: BollingerPoint[] = [];
  if (period < 1 || data.length < period) return [];

  for (let i = period - 1; i < data.length; i++) {
    const window = data.slice(i - period + 1, i + 1);
    const mean = window.reduce((s, c) => s + c.close, 0) / period;
    const variance = window.reduce((s, c) => s + (c.close - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    out.push({
      time: data[i].time,
      middle: mean,
      upper: mean + stdDev * sd,
      lower: mean - stdDev * sd,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// RSI — Relative Strength Index (Wilder smoothing)
//   RS = avgGain / avgLoss ;  RSI = 100 - 100 / (1 + RS)
//   avgLoss == 0  ->  RSI = 100
// ─────────────────────────────────────────────────────────────────────────────

export function rsi(candles: Candle[], period = DEFAULT_INDICATOR_PARAMS.rsiPeriod): IndicatorPoint[] {
  const data = sanitize(candles);
  const out: (number | null)[] = new Array(data.length).fill(null);
  if (period < 1 || data.length <= period) return [];

  // Seed: rata-rata sederhana dari `period` perubahan pertama
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const delta = data[i].close - data[i - 1].close;
    if (delta >= 0) gainSum += delta;
    else lossSum -= delta;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder smoothing
  for (let i = period + 1; i < data.length; i++) {
    const delta = data[i].close - data[i - 1].close;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return toPoints(data, out);
}

// ─────────────────────────────────────────────────────────────────────────────
// MACD
//   macd      = EMA(fast) - EMA(slow)
//   signal    = EMA(macd, signalPeriod)
//   histogram = macd - signal
// ─────────────────────────────────────────────────────────────────────────────

export function macd(
  candles: Candle[],
  fast = DEFAULT_INDICATOR_PARAMS.macdFast,
  slow = DEFAULT_INDICATOR_PARAMS.macdSlow,
  signalPeriod = DEFAULT_INDICATOR_PARAMS.macdSignal
): MACDPoint[] {
  const data = sanitize(candles);
  if (fast < 1 || slow < 1 || fast >= slow || data.length < slow) return [];

  const closes = data.map((c) => c.close);
  const fastEma = emaSeries(closes, fast);
  const slowEma = emaSeries(closes, slow);

  // macdLine terdefinisi hanya saat kedua EMA tersedia
  const macdLine: (number | null)[] = closes.map((_, i) =>
    fastEma[i] !== null && slowEma[i] !== null
      ? (fastEma[i] as number) - (slowEma[i] as number)
      : null
  );

  // EMA atas macdLine (hanya nilai non-null, lalu dipetakan balik ke indeks asli)
  const definedIdx: number[] = [];
  const definedVals: number[] = [];
  macdLine.forEach((v, i) => {
    if (v !== null) {
      definedIdx.push(i);
      definedVals.push(v);
    }
  });
  const signalEma = emaSeries(definedVals, signalPeriod);

  const out: MACDPoint[] = [];
  for (let k = 0; k < definedIdx.length; k++) {
    const sig = signalEma[k];
    if (sig === null) continue;
    const i = definedIdx[k];
    const macdVal = definedVals[k];
    out.push({
      time: data[i].time,
      macd: macdVal,
      signal: sig,
      histogram: macdVal - sig,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung satu indikator berdasarkan tipe + params.
 * Mengembalikan bentuk yang berbeda per tipe (lihat tipe di atas).
 */
export function computeIndicator(
  type: IndicatorType,
  candles: Candle[],
  params: IndicatorParams = {}
): IndicatorPoint[] | BollingerPoint[] | MACDPoint[] {
  const p = { ...DEFAULT_INDICATOR_PARAMS, ...params };
  switch (type) {
    case "SMA":
      return sma(candles, p.period);
    case "EMA":
      return ema(candles, p.period);
    case "VWAP":
      return vwap(candles);
    case "BB":
      return bollingerBands(candles, p.bbPeriod, p.bbStdDev);
    case "RSI":
      return rsi(candles, p.rsiPeriod);
    case "MACD":
      return macd(candles, p.macdFast, p.macdSlow, p.macdSignal);
    default:
      return [];
  }
}

/** Label singkat untuk legend, mis. `SMA(20)` atau `BB(20,2)`. */
export function indicatorLabel(type: IndicatorType, params: IndicatorParams = {}): string {
  const p = { ...DEFAULT_INDICATOR_PARAMS, ...params };
  switch (type) {
    case "SMA":
    case "EMA":
      return `${type}(${p.period})`;
    case "VWAP":
      return "VWAP";
    case "BB":
      return `BB(${p.bbPeriod},${p.bbStdDev})`;
    case "RSI":
      return `RSI(${p.rsiPeriod})`;
    case "MACD":
      return `MACD(${p.macdFast},${p.macdSlow},${p.macdSignal})`;
    default:
      return type;
  }
}
