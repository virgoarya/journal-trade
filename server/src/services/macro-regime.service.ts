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
export type MomentumStatus = "ACCELERATING" | "DECELERATING" | "NEUTRAL";
export type LiquidityRisk = "HEALTHY" | "STRESSED";

export type InflationPressure = "HOT" | "NORMAL" | "COLD";

export interface RatioMetric {
  current: number;
  ema50: number;
  status: MomentumStatus;
  pressure?: InflationPressure;
  label: string;
}

export interface MacroRegimeSnapshot {
  quadrant: MacroQuadrant;
  quadNumber: number;
  description: string;
  source: "YAHOO" | "CACHE";
  inflationSource: "FRED_CPI" | "TIP_TLT" | "UNKNOWN";
  cpiYoY: number | null;
  growth: RatioMetric;
  inflation: RatioMetric;
  liquidity: RatioMetric & { riskState: LiquidityRisk };
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

function classifyQuadrant(
  growth: MomentumStatus,
  inflation: MomentumStatus,
): { quadrant: MacroQuadrant; quadNumber: number; description: string } {
  if (growth === "ACCELERATING" && inflation === "ACCELERATING") {
    return {
      quadrant: "Reflation",
      quadNumber: 1,
      description: "Pertumbuhan dan inflasi sama-sama naik.",
    };
  }

  if (growth === "ACCELERATING" && inflation === "DECELERATING") {
    return {
      quadrant: "Goldilocks",
      quadNumber: 2,
      description: "Pertumbuhan naik dengan inflasi terkendali.",
    };
  }

  if (growth === "DECELERATING" && inflation === "ACCELERATING") {
    return {
      quadrant: "Stagflation",
      quadNumber: 3,
      description: "Pertumbuhan melambat dengan tekanan inflasi.",
    };
  }

  if (growth === "DECELERATING" && inflation === "DECELERATING") {
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

function classifyMomentum(deltaRelative: number): MomentumStatus {
  const ZSCORE_THRESHOLD = 0.0015;
  if (Math.abs(deltaRelative) < ZSCORE_THRESHOLD) return "NEUTRAL";
  return deltaRelative > 0 ? "ACCELERATING" : "DECELERATING";
}

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

// ─── EMA Calculation ─────────────────────────────────────────────
function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  if (data.length === 0) return ema;

  const k = 2 / (period + 1);

  // Seed EMA with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i];
  }
  ema.push(sum / Math.min(period, data.length));

  // Calculate subsequent EMA values
  for (let i = 1; i < data.length; i++) {
    const prev = ema[i - 1];
    ema.push(data[i] * k + prev * (1 - k));
  }

  return ema;
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
      `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${key}&file_type=json&sort_order=desc&limit=13`,
      { timeout: 5000 },
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

// ─── Quadrant Classifier ────────────────────────────────────────

// ─── Cache ──────────────────────────────────────────────────────
let cachedSnapshot: MacroRegimeSnapshot | null = null;
let cachedAt: number = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 menit — structural regime tidak perlu hit API tiap menit

// ─── Main Service ───────────────────────────────────────────────
export const macroRegimeService = {
  async getSnapshot(): Promise<MacroRegimeSnapshot> {
    if (cachedSnapshot && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cachedSnapshot;
    }

    const tickers = ["XLY", "XLP", "TIP", "TLT", "HYG", "SHY"];
    
    const fetchWithRetry = async (ticker: string, retries = 3): Promise<{ dates: string[]; closes: number[] }> => {
      try {
        return await fetchHistoricalClosePrices(ticker);
      } catch (error: any) {
        silentLogger.error(`[MacroRegime] Failed ${ticker} after retries:`, error.message);
        if (retries > 0 && (error.message.includes("timeout") || error.message.includes("rate"))) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchWithRetry(ticker, retries - 1);
        }
        // Return empty data instead of throwing
        return { dates: [], closes: [] };
      }
    };

    const results = await Promise.all(
      tickers.map((t) => fetchWithRetry(t)),
    );

    const [xlyData, xlpData, tipData, tltData, hygData, shyData] = results;

    const allSeries = [xlyData, xlpData, tipData, tltData, hygData, shyData];
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
        tip: alignedIndex(tipData, date),
        tlt: alignedIndex(tltData, date),
        hyg: alignedIndex(hygData, date),
        shy: alignedIndex(shyData, date),
      }))
      .filter(
        (item) =>
          typeof item.xly === "number" &&
          typeof item.xlp === "number" &&
          typeof item.tip === "number" &&
          typeof item.tlt === "number" &&
          typeof item.hyg === "number" &&
          typeof item.shy === "number",
      );

    const minLen = aligned.length;
    if (minLen < 30) {
      silentLogger.warn("[MacroRegime] Insufficient ETF data, using fallback values");
      // Return fallback snapshot instead of throwing
      const fallback: MacroRegimeSnapshot = {
        quadrant: "Transition",
        quadNumber: 0,
        description: "Data kurang lengkap - menggunakan default values",
        source: "CACHE",
        inflationSource: "UNKNOWN",
        cpiYoY: null,
        growth: { current: 1.0, ema50: 1.0, status: "NEUTRAL", label: "XLY/XLP" },
        inflation: { current: 1.0, ema50: 1.0, status: "NEUTRAL", pressure: "NORMAL", label: "TIP/TLT" },
        liquidity: { current: 1.0, ema50: 1.0, status: "NEUTRAL", riskState: "HEALTHY", label: "HYG/SHY" },
        position: { x: 0.5, y: 0.5 },
        history: [],
        fetchedAt: new Date().toISOString(),
      };
      cachedSnapshot = fallback;
      cachedAt = Date.now();
      return fallback;
    }

    const xly = aligned.map((item) => item.xly as number);
    const xlp = aligned.map((item) => item.xlp as number);
    const tip = aligned.map((item) => item.tip as number);
    const tlt = aligned.map((item) => item.tlt as number);
    const hyg = aligned.map((item) => item.hyg as number);
    const shy = aligned.map((item) => item.shy as number);
    const dates = aligned.map((item) => item.date);

    // 3. Calculate ratios on trimmed data
    const growthRatios: number[] = [];
    const inflationRatios: number[] = [];
    const liquidityRatios: number[] = [];

    for (let i = 0; i < minLen; i++) {
      growthRatios.push(xlp[i] !== 0 ? xly[i] / xlp[i] : 0);
      inflationRatios.push(tlt[i] !== 0 ? tip[i] / tlt[i] : 0);
      liquidityRatios.push(shy[i] !== 0 ? hyg[i] / shy[i] : 0);
    }

    // 4. Calculate EMA-50 for each ratio (seed with SMA of first 50, then EMA)
    const EMA_PERIOD = 50;
    const growthEma = calculateEMA(growthRatios, EMA_PERIOD);
    const inflationEma = calculateEMA(inflationRatios, EMA_PERIOD);
    const liquidityEma = calculateEMA(liquidityRatios, EMA_PERIOD);

    // 5. Get current values (last data point)
    const lastIdx = minLen - 1;
    const currentGrowth = growthRatios[lastIdx];
    const currentInflation = inflationRatios[lastIdx];
    const currentLiquidity = liquidityRatios[lastIdx];

    const currentGrowthEma = growthEma[lastIdx];
    const currentInflationEma = inflationEma[lastIdx];
    const currentLiquidityEma = liquidityEma[lastIdx];

    // 6. Determine statuses using 0.15% threshold relative to EMA-50
    const growthDeltaRelative =
      currentGrowthEma !== 0
        ? (currentGrowth - currentGrowthEma) / currentGrowthEma
        : 0;
    const inflationDeltaRelative =
      currentInflationEma !== 0
        ? (currentInflation - currentInflationEma) / currentInflationEma
        : 0;

    const growthStatus = classifyMomentum(growthDeltaRelative);
    const inflationStatus = classifyMomentum(inflationDeltaRelative);
    const liquidityStatus: MomentumStatus =
      currentLiquidity > currentLiquidityEma ? "ACCELERATING" : "DECELERATING";
    const liquidityRisk: LiquidityRisk =
      currentLiquidity > currentLiquidityEma ? "HEALTHY" : "STRESSED";

    const cpiYoY = await fetchLatestCpiYoY();
    const inflationPressure =
      cpiYoY === null
        ? classifyInflationPressure(inflationRatios, currentInflation)
        : cpiYoY >= 3.5
          ? "HOT"
          : cpiYoY <= 2
            ? "COLD"
            : "NORMAL";
    const inflationSource = cpiYoY === null ? "TIP_TLT" : "FRED_CPI";

    const { quadrant, quadNumber, description } = classifyQuadrant(
      growthStatus,
      inflationStatus
    );

    // 8. Calculate position for visual dot
    // Normalize: how far above/below EMA as percentage of EMA
    const growthDelta =
      currentGrowthEma !== 0
        ? (currentGrowth - currentGrowthEma) / currentGrowthEma
        : 0;
    const inflationDelta =
      currentInflationEma !== 0
        ? (currentInflation - currentInflationEma) / currentInflationEma
        : 0;

    // Clamp to -1..+1 range, scale by 100 for visibility
    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));
    const posX = clamp(growthDelta * 100, -1, 1); // positive = right (growth up)
    const posY = clamp(inflationDelta * 100, -1, 1); // positive = up (inflation up)

    // 9. Build historical array (last 30 trading days)
    const historyStart = Math.max(0, minLen - 30);
    const history: MacroRegimeSnapshot["history"] = [];
    for (let i = historyStart; i < minLen; i++) {
      const growthDeltaHistory =
        growthEma[i] !== 0
          ? (growthRatios[i] - growthEma[i]) / growthEma[i]
          : 0;
      const inflationDeltaHistory =
        inflationEma[i] !== 0
          ? (inflationRatios[i] - inflationEma[i]) / inflationEma[i]
          : 0;
      const gs = classifyMomentum(growthDeltaHistory);
      const is = classifyMomentum(inflationDeltaHistory);
      const { quadrant: hq } = classifyQuadrant(gs, is);
      history.push({
        date: dates[i],
        growthRatio: parseFloat(growthRatios[i].toFixed(6)),
        growthEma: parseFloat(growthEma[i].toFixed(6)),
        inflationRatio: parseFloat(inflationRatios[i].toFixed(6)),
        inflationEma: parseFloat(inflationEma[i].toFixed(6)),
        inflationPressure: classifyInflationPressure(inflationRatios, inflationRatios[i]),
        liquidityRatio: parseFloat(liquidityRatios[i].toFixed(6)),
        liquidityEma: parseFloat(liquidityEma[i].toFixed(6)),
        quadrant: hq,
      });
    }

    // 10. Assemble snapshot
    const snapshot: MacroRegimeSnapshot = {
      quadrant,
      quadNumber,
      description,
      source: cachedSnapshot ? "CACHE" : "YAHOO",
      inflationSource,
      cpiYoY,
      growth: {
        current: parseFloat(currentGrowth.toFixed(6)),
        ema50: parseFloat(currentGrowthEma.toFixed(6)),
        status: growthStatus,
        label: "XLY / XLP",
      },
      inflation: {
        current: parseFloat(currentInflation.toFixed(6)),
        ema50: parseFloat(currentInflationEma.toFixed(6)),
        status: inflationStatus,
        pressure: inflationPressure,
        label: "TIP / TLT",
      },
      liquidity: {
        current: parseFloat(currentLiquidity.toFixed(6)),
        ema50: parseFloat(currentLiquidityEma.toFixed(6)),
        status: liquidityStatus,
        label: "HYG / SHY",
        riskState: liquidityRisk,
      },
      position: {
        x: parseFloat(posX.toFixed(4)),
        y: parseFloat(posY.toFixed(4)),
      },
      history,
      fetchedAt: new Date().toISOString(),
    };

    // Cache it
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
