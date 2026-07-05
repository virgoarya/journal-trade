import axios from "axios";
import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";

// ─── Types ───────────────────────────────────────────────────────
export type MacroQuadrant =
  | "Goldilocks"
  | "Reflation"
  | "Stagflation"
  | "Deflation"
  | "Transition";
export type MomentumStatus = "ACCELERATING" | "DECELERATING" | "TURNING" | "NEUTRAL";
export type LiquidityRisk = "HEALTHY" | "STRESSED";
export type InflationPressure = "HOT" | "NORMAL" | "COLD";
export type ConfidenceLabel = "LOW" | "MODERATE" | "HIGH" | "VERY HIGH";

export interface SubScore {
  ratio: number;
  status: MomentumStatus;
}

export interface RatioMetric {
  current: number;
  ema10: number;
  ema50: number;
  roc5d: number;
  status: MomentumStatus;
  pressure?: InflationPressure;
  label: string;
  subScores?: Record<string, SubScore | { value: number | null; status: string }>;
}

export interface ConfidenceMetric {
  score: number;
  conviction: number;
  agreement: number;
  persistence: number;
  label: ConfidenceLabel;
}

export interface MacroRegimeSnapshot {
  quadrant: MacroQuadrant;
  quadNumber: number;
  description: string;
  source: "YAHOO" | "CACHE";
  inflationSource: "FRED_CPI" | "TIP_IEF" | "UNKNOWN";
  cpiYoY: number | null;
  growth: RatioMetric;
  inflation: RatioMetric;
  liquidity: RatioMetric & { riskState: LiquidityRisk };
  confidence: ConfidenceMetric;
  position: { x: number; y: number };
  history: Array<{
    date: string;
    growthRatio: number;
    growthEma: number;
    inflationRatio: number;
    inflationEma: number;
    inflationPressure?: InflationPressure;
    liquidityRatio: number;
    liquidityEma: number;
    quadrant: MacroQuadrant;
  }>;
  fetchedAt: string;
}

// ─── Quadrant Classifier ────────────────────────────────────────
function classifyQuadrant(
  growth: MomentumStatus,
  inflation: MomentumStatus,
): { quadrant: MacroQuadrant; quadNumber: number; description: string } {
  // TURNING is treated as the direction it's turning towards
  // For classification, TURNING counts as the emerging direction
  const effectiveGrowth = growth === "TURNING" ? "NEUTRAL" : growth;
  const effectiveInflation = inflation === "TURNING" ? "NEUTRAL" : inflation;

  if (effectiveGrowth === "ACCELERATING" && effectiveInflation === "ACCELERATING") {
    return {
      quadrant: "Reflation",
      quadNumber: 1,
      description: "Pertumbuhan dan inflasi sama-sama naik.",
    };
  }

  if (effectiveGrowth === "ACCELERATING" && effectiveInflation === "DECELERATING") {
    return {
      quadrant: "Goldilocks",
      quadNumber: 2,
      description: "Pertumbuhan naik dengan inflasi terkendali.",
    };
  }

  if (effectiveGrowth === "DECELERATING" && effectiveInflation === "ACCELERATING") {
    return {
      quadrant: "Stagflation",
      quadNumber: 3,
      description: "Pertumbuhan melambat dengan tekanan inflasi.",
    };
  }

  if (effectiveGrowth === "DECELERATING" && effectiveInflation === "DECELERATING") {
    return {
      quadrant: "Deflation",
      quadNumber: 4,
      description: "Pertumbuhan dan inflasi sama-sama melambat.",
    };
  }

  return {
    quadrant: "Transition",
    quadNumber: 0,
    description: "Sinyal makro belum mengarah kuat ke satu kuadran.",
  };
}

// ─── Momentum Classification (Dual-EMA + ROC) ──────────────────
// Uses EMA-10 vs EMA-50 crossover + ROC direction for leading detection
function classifyMomentumDualEMA(
  current: number,
  ema10: number,
  ema50: number,
  roc5d: number,
): MomentumStatus {
  const CROSS_THRESHOLD = 0.0008; // 0.08% dead zone to filter noise
  const ROC_THRESHOLD = 0.05; // 0.05% minimum ROC to count

  const deltaFastSlow = ema50 !== 0 ? (ema10 - ema50) / ema50 : 0;
  const absDelta = Math.abs(deltaFastSlow);

  // Dead zone — no clear signal
  if (absDelta < CROSS_THRESHOLD && Math.abs(roc5d) < ROC_THRESHOLD) {
    return "NEUTRAL";
  }

  // TURNING: EMA-10 just crossed EMA-50 but not yet established
  // Detected when: delta is small (near crossover) but ROC shows directional momentum
  if (absDelta < CROSS_THRESHOLD * 3 && Math.abs(roc5d) >= ROC_THRESHOLD) {
    return "TURNING";
  }

  // ACCELERATING: EMA-10 above EMA-50 (upward momentum)
  if (deltaFastSlow > CROSS_THRESHOLD) {
    return "ACCELERATING";
  }

  // DECELERATING: EMA-10 below EMA-50 (downward momentum)
  if (deltaFastSlow < -CROSS_THRESHOLD) {
    return "DECELERATING";
  }

  return "NEUTRAL";
}

// ─── Percentile Calculation ─────────────────────────────────────
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function classifyInflationPressure(
  values: number[],
  current: number,
): InflationPressure {
  const p30 = percentile(values, 30);
  const p70 = percentile(values, 70);

  if (current >= p70) return "HOT";
  if (current <= p30) return "COLD";
  return "NORMAL";
}

function calculateConfidence(
  growthSubStatuses: MomentumStatus[],
  inflationSubStatuses: MomentumStatus[],
  growthDelta: number,
  inflationDelta: number,
  history: Array<{ quadrant: MacroQuadrant }>,
  currentQuadrant: MacroQuadrant,
): ConfidenceMetric {
  // 1. CONVICTION (0-40): Distance from neutral zone (Z-Score magnitude)
  const avgDelta = (Math.abs(growthDelta) + Math.abs(inflationDelta)) / 2;
  // Scale: 0.02 (2% delta) = 40pts (max). So avgDelta * 2000
  const conviction = Math.min(40, Math.round(avgDelta * 2000));

  // 2. AGREEMENT (0-30): How many sub-indicators agree with the CURRENT quadrant direction
  let agreementVotes = 0;
  const totalIndicators = growthSubStatuses.length + inflationSubStatuses.length;

  for (const s of growthSubStatuses) {
    if (currentQuadrant === "Goldilocks" || currentQuadrant === "Reflation") {
      if (s === "ACCELERATING") agreementVotes++;
    } else if (currentQuadrant === "Stagflation" || currentQuadrant === "Deflation") {
      if (s === "DECELERATING") agreementVotes++;
    }
  }

  for (const s of inflationSubStatuses) {
    if (currentQuadrant === "Reflation" || currentQuadrant === "Stagflation") {
      if (s === "ACCELERATING") agreementVotes++;
    } else if (currentQuadrant === "Goldilocks" || currentQuadrant === "Deflation") {
      if (s === "DECELERATING") agreementVotes++;
    }
  }

  if (currentQuadrant === "Transition") {
    agreementVotes = 0;
  }

  const agreement = totalIndicators > 0
    ? Math.round((agreementVotes / totalIndicators) * 30)
    : 0;

  // 3. PERSISTENCE (0-30): Consecutive days current regime has held in history
  let consecutiveDays = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].quadrant === currentQuadrant) {
      consecutiveDays++;
    } else {
      break;
    }
  }
  // Scale: 25+ days = 30pts (max)
  const persistence = Math.min(30, Math.round((consecutiveDays / 25) * 30));

  const score = conviction + agreement + persistence;

  let label: ConfidenceLabel;
  if (score < 30) label = "LOW";
  else if (score < 55) label = "MODERATE";
  else if (score < 75) label = "HIGH";
  else label = "VERY HIGH";

  return { score, conviction, agreement, persistence, label };
}

// ─── EMA Calculation ─────────────────────────────────────────────
function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  if (data.length === 0) return ema;

  const k = 2 / (period + 1);
  const initialPeriod = Math.min(period, data.length);

  // Seed EMA with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < initialPeriod; i++) {
    sum += data[i];
  }
  const sma = sum / initialPeriod;

  for (let i = 0; i < initialPeriod; i++) {
    ema.push(sma);
  }

  // Calculate subsequent EMA values
  for (let i = initialPeriod; i < data.length; i++) {
    const prev = ema[i - 1];
    ema.push(data[i] * k + prev * (1 - k));
  }

  return ema;
}

// ─── Rate of Change (5-day) ─────────────────────────────────────
function calculateROC(data: number[], period: number = 5): number[] {
  const roc: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period || data[i - period] === 0) {
      roc.push(0);
    } else {
      roc.push(((data[i] / data[i - period]) - 1) * 100);
    }
  }
  return roc;
}

function calculateComposite(
  ratios: { values: number[]; weight: number }[],
): number[] {
  if (ratios.length === 0) return [];
  const len = Math.min(...ratios.map((r) => r.values.length));
  
  // Normalize each ratio series so the first valid element is 1.0
  // This prevents high-absolute-value ratios (like GLD/UUP) from dominating the composite
  const normalizedRatios = ratios.map(r => {
    let base = 1;
    for (let i = 0; i < len; i++) {
      if (r.values[i] !== 0) {
        base = r.values[i];
        break;
      }
    }
    return {
      weight: r.weight,
      values: r.values.map(v => v === 0 ? 0 : v / base)
    };
  });

  const composite: number[] = [];

  for (let i = 0; i < len; i++) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const r of normalizedRatios) {
      if (i < r.values.length && r.values[i] !== 0) {
        weightedSum += r.values[i] * r.weight;
        totalWeight += r.weight;
      }
    }
    composite.push(totalWeight > 0 ? weightedSum / totalWeight : 0);
  }

  return composite;
}

// ─── Yahoo Finance Historical Data Fetcher ───────────────────────
async function fetchHistoricalClosePrices(
  ticker: string,
  days: number = 150,
): Promise<{ dates: string[]; closes: number[] }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=6mo&interval=1d`;
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const result = response.data?.chart?.result?.[0];
    if (!result) {
      throw new Error(`No chart data for ${ticker}`);
    }

    const timestamps: number[] = result.timestamp || [];
    const closeArr = result.indicators?.quote?.[0]?.close || [];

    if (!timestamps.length || !closeArr.length) {
      throw new Error(`Empty data arrays for ${ticker}`);
    }

    const dates: string[] = [];
    const validCloses: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closeArr[i];
      if (close !== null && close !== undefined && !Number.isNaN(close)) {
        const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
        dates.push(date);
        validCloses.push(close);
      }
    }

    if (!dates.length) {
      throw new Error(`No valid close prices for ${ticker}`);
    }

    return { dates, closes: validCloses };
  } catch (error: any) {
    silentLogger.error(
      `[MacroRegime] Failed to fetch ${ticker}:`,
      error.message,
    );
    throw new Error(`Failed to fetch historical data for ${ticker}: ${error.message}`);
  }
}

async function fetchLatestCpiYoY(): Promise<number | null> {
  if (env.MACRO_CPI_YOY_OVERRIDE !== undefined) {
    return env.MACRO_CPI_YOY_OVERRIDE;
  }

  const key = env.FRED_API_KEY;
  if (!key) return null;

  try {
    const response = await axios.get(
      `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${key}&file_type=json&sort_order=desc&limit=24`,
      { timeout: 15000 },
    );
    const observations = response.data?.observations ?? [];
    const values = observations
      .map((obs: any) => parseFloat(obs.value))
      .filter((value: number) => Number.isFinite(value));

    if (values.length < 13) return null;
    return ((values[0] / values[12]) - 1) * 100;
  } catch (error: any) {
    silentLogger.warn("[MacroRegime] CPI fetch failed:", error.message);
    return null;
  }
}

// ─── Cache ──────────────────────────────────────────────────────
let cachedSnapshot: MacroRegimeSnapshot | null = null;
let cachedAt: number = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Main Service ───────────────────────────────────────────────
export const macroRegimeService = {
  async getSnapshot(): Promise<MacroRegimeSnapshot> {
    if (cachedSnapshot && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cachedSnapshot;
    }

    // ── Fetch all required ETFs ──────────────────────────────────
    // Growth composite: XLY/XLP (40%), IWM/TLT (30%), XLI/XLU (30%)
    // Inflation composite: TIP/IEF (50%), GLD/UUP (20%), CPI YoY (30%) from FRED
    // Liquidity: HYG/SHY
    const tickers = [
      "XLY", "XLP",   // Growth primary
      "IWM", "TLT",   // Growth secondary
      "XLI", "XLU",   // Growth tertiary
      "TIP", "IEF",   // Inflation primary
      "GLD", "UUP",   // Inflation tertiary
      "HYG", "SHY",   // Liquidity
    ];

    const fetchWithRetry = async (ticker: string, retries = 3): Promise<{ dates: string[]; closes: number[] }> => {
      try {
        return await fetchHistoricalClosePrices(ticker);
      } catch (error: any) {
        silentLogger.error(`[MacroRegime] Failed ${ticker} after retries:`, error.message);
        if (retries > 0 && (error.message.includes("timeout") || error.message.includes("rate"))) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchWithRetry(ticker, retries - 1);
        }
        return { dates: [], closes: [] };
      }
    };

    const results = await Promise.all(
      tickers.map((t) => fetchWithRetry(t)),
    );

    const [
      xlyData, xlpData,
      iwmData, tltData,
      xliData, xluData,
      tipData, iefData,
      gldData, uupData,
      hygData, shyData,
    ] = results;

    // ── Align all series by date ─────────────────────────────────
    const allSeries = results;
    const alignedDates = [...new Set(allSeries.flatMap((item) => item.dates))]
      .sort()
      .slice(-150);

    const alignedIndex = (item: { dates: string[]; closes: number[] }, date: string) => {
      const idx = item.dates.indexOf(date);
      return idx >= 0 ? item.closes[idx] : null;
    };

    const aligned = alignedDates
      .map((date) => ({
        date,
        xly: alignedIndex(xlyData, date),
        xlp: alignedIndex(xlpData, date),
        iwm: alignedIndex(iwmData, date),
        tlt: alignedIndex(tltData, date),
        xli: alignedIndex(xliData, date),
        xlu: alignedIndex(xluData, date),
        tip: alignedIndex(tipData, date),
        ief: alignedIndex(iefData, date),
        gld: alignedIndex(gldData, date),
        uup: alignedIndex(uupData, date),
        hyg: alignedIndex(hygData, date),
        shy: alignedIndex(shyData, date),
      }))
      .filter(
        (item) =>
          typeof item.xly === "number" &&
          typeof item.xlp === "number" &&
          typeof item.tip === "number" &&
          typeof item.ief === "number" &&
          typeof item.hyg === "number" &&
          typeof item.shy === "number",
      );

    const minLen = aligned.length;
    if (minLen < 30) {
      silentLogger.warn("[MacroRegime] Insufficient ETF data, using fallback values");
      const fallback: MacroRegimeSnapshot = {
        quadrant: "Transition",
        quadNumber: 0,
        description: "Data kurang lengkap - menggunakan default values",
        source: "CACHE",
        inflationSource: "UNKNOWN",
        cpiYoY: null,
        growth: { current: 1.0, ema10: 1.0, ema50: 1.0, roc5d: 0, status: "NEUTRAL", label: "Composite (XLY/XLP · IWM/TLT · XLI/XLU)" },
        inflation: { current: 1.0, ema10: 1.0, ema50: 1.0, roc5d: 0, status: "NEUTRAL", pressure: "NORMAL", label: "Composite (TIP/IEF · CPI · GLD/UUP)" },
        liquidity: { current: 1.0, ema10: 1.0, ema50: 1.0, roc5d: 0, status: "NEUTRAL", riskState: "HEALTHY", label: "HYG/SHY" },
        confidence: { score: 0, conviction: 0, agreement: 0, persistence: 0, label: "LOW" },
        position: { x: 0.5, y: 0.5 },
        history: [],
        fetchedAt: new Date().toISOString(),
      };
      cachedSnapshot = fallback;
      cachedAt = Date.now();
      return fallback;
    }

    // ── Calculate individual ratios ──────────────────────────────
    const xlyXlpRatios: number[] = [];
    const iwmTltRatios: number[] = [];
    const xliXluRatios: number[] = [];
    const tipIefRatios: number[] = [];
    const gldUupRatios: number[] = [];
    const hygShyRatios: number[] = [];
    const dates = aligned.map((item) => item.date);

    for (let i = 0; i < minLen; i++) {
      const item = aligned[i];
      xlyXlpRatios.push(item.xlp !== 0 ? (item.xly as number) / (item.xlp as number) : 0);

      // Secondary growth: IWM/TLT — fallback to 0 if either is missing
      if (typeof item.iwm === "number" && typeof item.tlt === "number" && item.tlt !== 0) {
        iwmTltRatios.push(item.iwm / item.tlt);
      } else {
        iwmTltRatios.push(0);
      }

      // Tertiary growth: XLI/XLU — fallback to 0 if either is missing
      if (typeof item.xli === "number" && typeof item.xlu === "number" && item.xlu !== 0) {
        xliXluRatios.push(item.xli / item.xlu);
      } else {
        xliXluRatios.push(0);
      }

      tipIefRatios.push(item.ief !== 0 ? (item.tip as number) / (item.ief as number) : 0);

      // Inflation tertiary: GLD/UUP — fallback to 0 if either is missing
      if (typeof item.gld === "number" && typeof item.uup === "number" && item.uup !== 0) {
        gldUupRatios.push(item.gld / item.uup);
      } else {
        gldUupRatios.push(0);
      }

      hygShyRatios.push(item.shy !== 0 ? (item.hyg as number) / (item.shy as number) : 0);
    }

    // ── Build composite ratios ───────────────────────────────────
    // Growth: XLY/XLP (40%) + IWM/TLT (30%) + XLI/XLU (30%)
    const hasIwmTlt = iwmTltRatios.some((v) => v !== 0);
    const hasXliXlu = xliXluRatios.some((v) => v !== 0);

    const growthComponents: { values: number[]; weight: number }[] = [
      { values: xlyXlpRatios, weight: 0.4 },
    ];
    if (hasIwmTlt) growthComponents.push({ values: iwmTltRatios, weight: 0.3 });
    if (hasXliXlu) growthComponents.push({ values: xliXluRatios, weight: 0.3 });

    // If secondary/tertiary are missing, normalize weights to primary only
    const growthCompositeRatios = growthComponents.length > 1
      ? calculateComposite(growthComponents)
      : xlyXlpRatios;

    // Inflation: TIP/IEF (50%) + GLD/UUP (20%) — CPI handled separately
    const hasGldUup = gldUupRatios.some((v) => v !== 0);
    const inflationComponents: { values: number[]; weight: number }[] = [
      { values: tipIefRatios, weight: hasGldUup ? 0.7 : 1.0 },
    ];
    if (hasGldUup) inflationComponents.push({ values: gldUupRatios, weight: 0.3 });

    const inflationCompositeRatios = inflationComponents.length > 1
      ? calculateComposite(inflationComponents)
      : tipIefRatios;

    // Liquidity: HYG/SHY (single ratio)
    const liquidityRatios = hygShyRatios;

    // ── Calculate EMAs (Dual: EMA-10 + EMA-50) ──────────────────
    const EMA_FAST = 10;
    const EMA_SLOW = 50;

    const growthEma10 = calculateEMA(growthCompositeRatios, EMA_FAST);
    const growthEma50 = calculateEMA(growthCompositeRatios, EMA_SLOW);
    const inflationEma10 = calculateEMA(inflationCompositeRatios, EMA_FAST);
    const inflationEma50 = calculateEMA(inflationCompositeRatios, EMA_SLOW);
    const liquidityEma10 = calculateEMA(liquidityRatios, EMA_FAST);
    const liquidityEma50 = calculateEMA(liquidityRatios, EMA_SLOW);

    // ── Calculate ROC-5d ─────────────────────────────────────────
    const growthRoc = calculateROC(growthCompositeRatios, 5);
    const inflationRoc = calculateROC(inflationCompositeRatios, 5);
    const liquidityRoc = calculateROC(liquidityRatios, 5);

    // ── Get current values (last data point) ─────────────────────
    const lastIdx = minLen - 1;
    const currentGrowth = growthCompositeRatios[lastIdx];
    const currentInflation = inflationCompositeRatios[lastIdx];
    const currentLiquidity = liquidityRatios[lastIdx];

    const currentGrowthEma10 = growthEma10[lastIdx];
    const currentGrowthEma50 = growthEma50[lastIdx];
    const currentInflationEma10 = inflationEma10[lastIdx];
    const currentInflationEma50 = inflationEma50[lastIdx];
    const currentLiquidityEma10 = liquidityEma10[lastIdx];
    const currentLiquidityEma50 = liquidityEma50[lastIdx];

    const currentGrowthRoc = growthRoc[lastIdx];
    const currentInflationRoc = inflationRoc[lastIdx];
    const currentLiquidityRoc = liquidityRoc[lastIdx];

    // ── Classify momentum with Dual-EMA + ROC ────────────────────
    const growthStatus = classifyMomentumDualEMA(
      currentGrowth, currentGrowthEma10, currentGrowthEma50, currentGrowthRoc,
    );
    const inflationStatus = classifyMomentumDualEMA(
      currentInflation, currentInflationEma10, currentInflationEma50, currentInflationRoc,
    );
    const liquidityStatus = classifyMomentumDualEMA(
      currentLiquidity, currentLiquidityEma10, currentLiquidityEma50, currentLiquidityRoc,
    );
    const liquidityRisk: LiquidityRisk =
      currentLiquidity > currentLiquidityEma50 ? "HEALTHY" : "STRESSED";

    // ── Sub-score statuses (for each individual ratio) ───────────
    const lastXlyXlpEma10 = calculateEMA(xlyXlpRatios, EMA_FAST);
    const lastXlyXlpEma50 = calculateEMA(xlyXlpRatios, EMA_SLOW);
    const xlyXlpRoc = calculateROC(xlyXlpRatios, 5);
    const xlyXlpStatus = classifyMomentumDualEMA(
      xlyXlpRatios[lastIdx], lastXlyXlpEma10[lastIdx], lastXlyXlpEma50[lastIdx], xlyXlpRoc[lastIdx],
    );

    let iwmTltStatus: MomentumStatus = "NEUTRAL";
    if (hasIwmTlt) {
      const iwmTltEma10 = calculateEMA(iwmTltRatios, EMA_FAST);
      const iwmTltEma50 = calculateEMA(iwmTltRatios, EMA_SLOW);
      const iwmTltRoc = calculateROC(iwmTltRatios, 5);
      iwmTltStatus = classifyMomentumDualEMA(
        iwmTltRatios[lastIdx], iwmTltEma10[lastIdx], iwmTltEma50[lastIdx], iwmTltRoc[lastIdx],
      );
    }

    let xliXluStatus: MomentumStatus = "NEUTRAL";
    if (hasXliXlu) {
      const xliXluEma10 = calculateEMA(xliXluRatios, EMA_FAST);
      const xliXluEma50 = calculateEMA(xliXluRatios, EMA_SLOW);
      const xliXluRoc = calculateROC(xliXluRatios, 5);
      xliXluStatus = classifyMomentumDualEMA(
        xliXluRatios[lastIdx], xliXluEma10[lastIdx], xliXluEma50[lastIdx], xliXluRoc[lastIdx],
      );
    }

    const tipIefEma10 = calculateEMA(tipIefRatios, EMA_FAST);
    const tipIefEma50 = calculateEMA(tipIefRatios, EMA_SLOW);
    const tipIefRoc = calculateROC(tipIefRatios, 5);
    const tipIefStatus = classifyMomentumDualEMA(
      tipIefRatios[lastIdx], tipIefEma10[lastIdx], tipIefEma50[lastIdx], tipIefRoc[lastIdx],
    );

    let gldUupStatus: MomentumStatus = "NEUTRAL";
    if (hasGldUup) {
      const gldUupEma10 = calculateEMA(gldUupRatios, EMA_FAST);
      const gldUupEma50 = calculateEMA(gldUupRatios, EMA_SLOW);
      const gldUupRoc = calculateROC(gldUupRatios, 5);
      gldUupStatus = classifyMomentumDualEMA(
        gldUupRatios[lastIdx], gldUupEma10[lastIdx], gldUupEma50[lastIdx], gldUupRoc[lastIdx],
      );
    }

    // ── CPI YoY + Inflation Pressure ─────────────────────────────
    const cpiYoY = await fetchLatestCpiYoY();
    const inflationPressure =
      cpiYoY === null
        ? classifyInflationPressure(inflationCompositeRatios, currentInflation)
        : cpiYoY >= 3.5
          ? "HOT"
          : cpiYoY <= 2
            ? "COLD"
            : "NORMAL";
    const inflationSource = cpiYoY === null ? "TIP_IEF" : "FRED_CPI";

    // CPI status for sub-score
    let cpiStatus = "NEUTRAL";
    if (cpiYoY !== null) {
      cpiStatus = cpiYoY >= 3.5 ? "HOT" : cpiYoY <= 2 ? "COLD" : "NORMAL";
    }

    // ── Classify Quadrant ────────────────────────────────────────
    const { quadrant, quadNumber, description } = classifyQuadrant(
      growthStatus,
      inflationStatus,
    );

    // ── Build history (last 30 days) ─────────────────────────────
    const historyStart = Math.max(0, minLen - 30);
    const history: MacroRegimeSnapshot["history"] = [];
    for (let i = historyStart; i < minLen; i++) {
      const gDelta = growthEma50[i] !== 0
        ? (growthEma10[i] - growthEma50[i]) / growthEma50[i]
        : 0;
      const iDelta = inflationEma50[i] !== 0
        ? (inflationEma10[i] - inflationEma50[i]) / inflationEma50[i]
        : 0;
      const gs = classifyMomentumDualEMA(
        growthCompositeRatios[i], growthEma10[i], growthEma50[i], growthRoc[i],
      );
      const is = classifyMomentumDualEMA(
        inflationCompositeRatios[i], inflationEma10[i], inflationEma50[i], inflationRoc[i],
      );
      const { quadrant: hq } = classifyQuadrant(gs, is);
      history.push({
        date: dates[i],
        growthRatio: parseFloat(growthCompositeRatios[i].toFixed(6)),
        growthEma: parseFloat(growthEma50[i].toFixed(6)),
        inflationRatio: parseFloat(inflationCompositeRatios[i].toFixed(6)),
        inflationEma: parseFloat(inflationEma50[i].toFixed(6)),
        inflationPressure: classifyInflationPressure(inflationCompositeRatios, inflationCompositeRatios[i]),
        liquidityRatio: parseFloat(liquidityRatios[i].toFixed(6)),
        liquidityEma: parseFloat(liquidityEma50[i].toFixed(6)),
        quadrant: hq,
      });
    }

    // ── Calculate Confidence ─────────────────────────────────────
    const growthDeltaAbs = currentGrowthEma50 !== 0
      ? Math.abs((currentGrowthEma10 - currentGrowthEma50) / currentGrowthEma50)
      : 0;
    const inflationDeltaAbs = currentInflationEma50 !== 0
      ? Math.abs((currentInflationEma10 - currentInflationEma50) / currentInflationEma50)
      : 0;

    // Map CPI status to MomentumStatus for agreement calculation
    const cpiMomentumStatus: MomentumStatus =
      cpiStatus === "HOT" ? "ACCELERATING"
        : cpiStatus === "COLD" ? "DECELERATING"
          : "NEUTRAL";

    const confidence = calculateConfidence(
      [xlyXlpStatus, iwmTltStatus, xliXluStatus],
      [tipIefStatus, cpiMomentumStatus, gldUupStatus],
      growthDeltaAbs,
      inflationDeltaAbs,
      history,
      quadrant,
    );

    // ── Calculate position for visual dot ────────────────────────
    const growthDelta =
      currentGrowthEma50 !== 0
        ? (currentGrowth - currentGrowthEma50) / currentGrowthEma50
        : 0;
    const inflationDelta =
      currentInflationEma50 !== 0
        ? (currentInflation - currentInflationEma50) / currentInflationEma50
        : 0;

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));
    const posX = clamp(growthDelta * 100, -1, 1);
    const posY = clamp(inflationDelta * 100, -1, 1);

    // ── Assemble snapshot ────────────────────────────────────────
    const snapshot: MacroRegimeSnapshot = {
      quadrant,
      quadNumber,
      description,
      source: cachedSnapshot ? "CACHE" : "YAHOO",
      inflationSource,
      cpiYoY,
      growth: {
        current: parseFloat(currentGrowth.toFixed(6)),
        ema10: parseFloat(currentGrowthEma10.toFixed(6)),
        ema50: parseFloat(currentGrowthEma50.toFixed(6)),
        roc5d: parseFloat(currentGrowthRoc.toFixed(4)),
        status: growthStatus,
        label: "Composite (XLY/XLP · IWM/TLT · XLI/XLU)",
        subScores: {
          xlyXlp: { ratio: parseFloat(xlyXlpRatios[lastIdx].toFixed(6)), status: xlyXlpStatus },
          iwmTlt: { ratio: hasIwmTlt ? parseFloat(iwmTltRatios[lastIdx].toFixed(6)) : 0, status: iwmTltStatus },
          xliXlu: { ratio: hasXliXlu ? parseFloat(xliXluRatios[lastIdx].toFixed(6)) : 0, status: xliXluStatus },
        },
      },
      inflation: {
        current: parseFloat(currentInflation.toFixed(6)),
        ema10: parseFloat(currentInflationEma10.toFixed(6)),
        ema50: parseFloat(currentInflationEma50.toFixed(6)),
        roc5d: parseFloat(currentInflationRoc.toFixed(4)),
        status: inflationStatus,
        pressure: inflationPressure,
        label: "Composite (TIP/IEF · CPI · GLD/UUP)",
        subScores: {
          tipIef: { ratio: parseFloat(tipIefRatios[lastIdx].toFixed(6)), status: tipIefStatus },
          cpiYoY: { value: cpiYoY, status: cpiStatus },
          gldUup: { ratio: hasGldUup ? parseFloat(gldUupRatios[lastIdx].toFixed(6)) : 0, status: gldUupStatus },
        },
      },
      liquidity: {
        current: parseFloat(currentLiquidity.toFixed(6)),
        ema10: parseFloat(currentLiquidityEma10.toFixed(6)),
        ema50: parseFloat(currentLiquidityEma50.toFixed(6)),
        roc5d: parseFloat(currentLiquidityRoc.toFixed(4)),
        status: liquidityStatus,
        label: "HYG / SHY",
        riskState: liquidityRisk,
      },
      confidence,
      position: {
        x: parseFloat(posX.toFixed(4)),
        y: parseFloat(posY.toFixed(4)),
      },
      history,
      fetchedAt: new Date().toISOString(),
    };

    cachedSnapshot = snapshot;
    cachedAt = Date.now();

    return snapshot;
  },

  async forceRefresh(): Promise<MacroRegimeSnapshot> {
    cachedSnapshot = null;
    cachedAt = 0;
    return this.getSnapshot();
  },
};
