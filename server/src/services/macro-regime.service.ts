import axios from "axios";

// ─── Types ───────────────────────────────────────────────────────
export type MacroQuadrant = "Goldilocks" | "Reflation" | "Stagflation" | "Deflation";
export type MomentumStatus = "ACCELERATING" | "DECELERATING";
export type LiquidityRisk = "HEALTHY" | "STRESSED";

export interface RatioMetric {
  current: number;
  ema50: number;
  status: MomentumStatus;
  label: string;
}

export interface MacroRegimeSnapshot {
  quadrant: MacroQuadrant;
  quadNumber: number;
  description: string;
  growth: RatioMetric;
  inflation: RatioMetric;
  liquidity: RatioMetric & { riskState: LiquidityRisk };
  // Positioning within the quadrant (for the visual dot)
  // Values normalized: growth x-axis (-1 to +1), inflation y-axis (-1 to +1)
  position: { x: number; y: number };
  history: Array<{
    date: string;
    growthRatio: number;
    growthEma: number;
    inflationRatio: number;
    inflationEma: number;
    liquidityRatio: number;
    liquidityEma: number;
    quadrant: MacroQuadrant;
  }>;
  fetchedAt: string;
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
async function fetchHistoricalClosePrices(ticker: string, days: number = 150): Promise<{ dates: string[]; closes: number[] }> {
  try {
    // Use 6mo range to get ~130 trading days
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=6mo&interval=1d`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const result = response.data?.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${ticker}`);

    const timestamps: number[] = result.timestamp || [];
    const closes: number[] = result.indicators?.quote?.[0]?.close || [];

    const dates: string[] = [];
    const validCloses: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close !== null && close !== undefined && !isNaN(close)) {
        const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
        dates.push(date);
        validCloses.push(close);
      }
    }

    return { dates, closes: validCloses };
  } catch (error: any) {
    console.error(`[MacroRegime] Failed to fetch ${ticker}:`, error.message);
    throw new Error(`Failed to fetch historical data for ${ticker}`);
  }
}

// ─── Quadrant Classifier ────────────────────────────────────────
function classifyQuadrant(growthStatus: MomentumStatus, inflationStatus: MomentumStatus): { quadrant: MacroQuadrant; quadNumber: number; description: string } {
  if (growthStatus === "ACCELERATING" && inflationStatus === "DECELERATING") {
    return { quadrant: "Goldilocks", quadNumber: 1, description: "Growth ↑ Inflation ↓ — Ideal conditions: strong growth with controlled inflation." };
  }
  if (growthStatus === "ACCELERATING" && inflationStatus === "ACCELERATING") {
    return { quadrant: "Reflation", quadNumber: 2, description: "Growth ↑ Inflation ↑ — Expansion phase: both growth and prices rising." };
  }
  if (growthStatus === "DECELERATING" && inflationStatus === "ACCELERATING") {
    return { quadrant: "Stagflation", quadNumber: 3, description: "Growth ↓ Inflation ↑ — Worst case: slowing economy with rising prices." };
  }
  // DECELERATING && DECELERATING
  return { quadrant: "Deflation", quadNumber: 4, description: "Growth ↓ Inflation ↓ — Contraction: weakening economy and falling prices." };
}

// ─── Cache ──────────────────────────────────────────────────────
let cachedSnapshot: MacroRegimeSnapshot | null = null;
let cachedAt: number = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─── Main Service ───────────────────────────────────────────────
export const macroRegimeService = {
  async getSnapshot(): Promise<MacroRegimeSnapshot> {
    // Return cache if fresh
    if (cachedSnapshot && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cachedSnapshot;
    }

    console.log("[MacroRegime] Fetching fresh ETF data from Yahoo Finance...");

    // 1. Fetch all 6 tickers in parallel
    const tickers = ["XLY", "XLP", "TIP", "TLT", "HYG", "SHY"];
    const results = await Promise.all(tickers.map(t => fetchHistoricalClosePrices(t)));

    const [xlyData, xlpData, tipData, tltData, hygData, shyData] = results;

    // 2. Align data by minimum length (all tickers should have similar trading days)
    const minLen = Math.min(
      xlyData.closes.length,
      xlpData.closes.length,
      tipData.closes.length,
      tltData.closes.length,
      hygData.closes.length,
      shyData.closes.length
    );

    // Trim all to the same length (from the end, so we keep most recent data aligned)
    const trim = (arr: number[]) => arr.slice(arr.length - minLen);
    const trimDates = (arr: string[]) => arr.slice(arr.length - minLen);

    const xly = trim(xlyData.closes);
    const xlp = trim(xlpData.closes);
    const tip = trim(tipData.closes);
    const tlt = trim(tltData.closes);
    const hyg = trim(hygData.closes);
    const shy = trim(shyData.closes);
    const dates = trimDates(xlyData.dates);

    // 3. Calculate ratios
    const growthRatios: number[] = [];
    const inflationRatios: number[] = [];
    const liquidityRatios: number[] = [];

    for (let i = 0; i < minLen; i++) {
      growthRatios.push(xlp[i] !== 0 ? xly[i] / xlp[i] : 0);
      inflationRatios.push(tlt[i] !== 0 ? tip[i] / tlt[i] : 0);
      liquidityRatios.push(shy[i] !== 0 ? hyg[i] / shy[i] : 0);
    }

    // 4. Calculate EMA-50 for each ratio
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

    // 6. Determine statuses
    const growthStatus: MomentumStatus = currentGrowth > currentGrowthEma ? "ACCELERATING" : "DECELERATING";
    const inflationStatus: MomentumStatus = currentInflation > currentInflationEma ? "ACCELERATING" : "DECELERATING";
    const liquidityStatus: MomentumStatus = currentLiquidity > currentLiquidityEma ? "ACCELERATING" : "DECELERATING";
    const liquidityRisk: LiquidityRisk = currentLiquidity > currentLiquidityEma ? "HEALTHY" : "STRESSED";

    // 7. Classify quadrant
    const { quadrant, quadNumber, description } = classifyQuadrant(growthStatus, inflationStatus);

    // 8. Calculate position for visual dot
    // Normalize: how far above/below EMA as percentage of EMA
    const growthDelta = currentGrowthEma !== 0 ? (currentGrowth - currentGrowthEma) / currentGrowthEma : 0;
    const inflationDelta = currentInflationEma !== 0 ? (currentInflation - currentInflationEma) / currentInflationEma : 0;

    // Clamp to -1..+1 range, scale by 100 for visibility
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const posX = clamp(growthDelta * 100, -1, 1);   // positive = right (growth up)
    const posY = clamp(inflationDelta * 100, -1, 1); // positive = up (inflation up)

    // 9. Build historical array (last 30 trading days)
    const historyStart = Math.max(0, minLen - 30);
    const history: MacroRegimeSnapshot["history"] = [];
    for (let i = historyStart; i < minLen; i++) {
      const gs: MomentumStatus = growthRatios[i] > growthEma[i] ? "ACCELERATING" : "DECELERATING";
      const is: MomentumStatus = inflationRatios[i] > inflationEma[i] ? "ACCELERATING" : "DECELERATING";
      const { quadrant: hq } = classifyQuadrant(gs, is);
      history.push({
        date: dates[i],
        growthRatio: parseFloat(growthRatios[i].toFixed(6)),
        growthEma: parseFloat(growthEma[i].toFixed(6)),
        inflationRatio: parseFloat(inflationRatios[i].toFixed(6)),
        inflationEma: parseFloat(inflationEma[i].toFixed(6)),
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

    console.log(`[MacroRegime] Classified: ${quadrant} (Q${quadNumber}), Growth: ${growthStatus}, Inflation: ${inflationStatus}, Liquidity: ${liquidityRisk}`);

    return snapshot;
  },

  async forceRefresh(): Promise<MacroRegimeSnapshot> {
    cachedSnapshot = null;
    cachedAt = 0;
    return this.getSnapshot();
  },
};
