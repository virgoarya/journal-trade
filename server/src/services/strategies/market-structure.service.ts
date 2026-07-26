// ─── Market Structure Foundation ─────────────────────────────────────
// Core analytical layer for all SMC / ICT / MSNR / CRT / QT / LIT strategies.
// Transforms raw OHLCV data into structured concepts: swing points, order
// blocks, fair-value gaps, key levels, liquidity zones, quarterly pivots, etc.

// ─── Types ───────────────────────────────────────────────────────────

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface FractalContext {
  daily?: Candle[];
  direction: Candle[];
  setup: Candle[];
  entry: Candle[];
  dailyStr?: MarketStructure;
  directionStr: MarketStructure;
  setupStr: MarketStructure;
  entryStr: MarketStructure;
  isAligned: boolean;
  dailyTimeframeStr?: string;
  directionTimeframeStr?: string;
  setupTimeframeStr?: string;
  entryTimeframeStr?: string;
  spread?: number;
  point?: number;
}

export interface SwingHigh {
  index: number;
  price: number;
  time: number;
  strength: number; // 1‑5 based on surrounding candles
}

export interface SwingLow {
  index: number;
  price: number;
  time: number;
  strength: number;
}

export interface OrderBlock {
  index: number;
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  time: number;
  mitigated: boolean;
  /** How many times price has returned to this block */
  touchCount: number;
}

export interface BreakerBlock {
  orderBlock: OrderBlock;
  brokenDirection: "BULL" | "BEAR";
  flippedLevel: number;
  time: number;
}

export interface FVG {
  index: number;
  type: "BULLISH" | "BEARISH";
  /** gap top (higher price) */
  top: number;
  /** gap bottom (lower price) */
  bottom: number;
  mitigated: boolean;
  time: number;
  inverted?: boolean;
  invertedTime?: number;
}

export interface KeyLevel {
  price: number;
  type: "SUPPORT" | "RESISTANCE";
  strength: number; // 1‑5: touches / reversals at this level
  lastTested: number; // timestamp
}

export interface LiquidityZone {
  price: number;
  type: "BUY_SIDE" | "SELL_SIDE";
  density: number; // how many swing points cluster here
  swingIndices: number[];
  swept: boolean;
}

export interface Trend {
  direction: "BULL" | "BEAR" | "SIDEWAYS";
  strength: number; // 0‑100
}

export interface CandleRangeAnalysis {
  high: number;
  low: number;
  width: number;
  averageBody: number;
  averageWickTop: number;
  averageWickBottom: number;
  recentDisplacement: boolean;
}


export interface MalaysianSNR {
  price: number;
  type: "RESISTANCE" | "SUPPORT";
  time: number;
  index: number;
  isFresh: boolean;
  touchedByWick: boolean;
  brokenByBody: boolean;
  missed: boolean;
}

export interface MalaysianEngulfing {
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  time: number;
  index: number;
}

export interface MalaysianTrendline {
  p1: MalaysianSNR;
  p2: MalaysianSNR;
  type: "RESISTANCE" | "SUPPORT";
  slope: number;
}

export interface MarketStructure {
  swingHighs: SwingHigh[];
  swingLows: SwingLow[];
  trend: Trend;
  orderBlocks: OrderBlock[];
  breakerBlocks: BreakerBlock[];
  fairValueGaps: FVG[];
  keyLevels: KeyLevel[];
  liquidityZones: LiquidityZone[];
  candleRanges: CandleRangeAnalysis;
  malaysianSNRs: MalaysianSNR[];
  malaysianEngulfings: MalaysianEngulfing[];
  malaysianTrendlines: MalaysianTrendline[];

  recentPriceAction: "RANGING" | "EXPANSION_BULL" | "EXPANSION_BEAR" | "CONTRACTION";
}

// ─── Constants ───────────────────────────────────────────────────────

const SWING_LEFT_BARS = 3;
const SWING_RIGHT_BARS = 2;
const LEVEL_CLUSTER_TOLERANCE_PCT = 0.001; // 0.1% price tolerance for level grouping
const FVG_BODY_ONLY = true; // only consider body (open/close) for FVG, not wicks
const IMPULSE_THRESHOLD = 1.8; // × average candle range to be considered "impulsive"

export type KillzoneType = "ASIAN" | "LONDON" | "NEW_YORK" | "LONDON_CLOSE" | "NONE";
const KILLZONES = {
  ASIAN: { start: 19 * 60 + 0, end: 2 * 60 + 0 },    // 19:00 – 02:00 EST
  LONDON: { start: 2 * 60 + 0, end: 5 * 60 + 0 },     // 02:00 – 05:00 EST
  NEW_YORK: { start: 7 * 60 + 0, end: 10 * 60 + 0 },  // 07:00 – 10:00 EST
  LONDON_CLOSE: { start: 10 * 60 + 0, end: 12 * 60 + 0 }, // 10:00 – 12:00 EST
};

// ─── Service ─────────────────────────────────────────────────────────

class MarketStructureService {
  /** Get EST minutes from timestamp (0-1439). */
  getEstMinutesFromTimestamp(timestamp: number): number {
    const d = new Date(timestamp * 1000);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "0");
    const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0");
    return h * 60 + m;
  }

  /** Get killzone for a given timestamp (used in backtesting). */
  getKillzoneForTimestamp(timestamp: number): KillzoneType {
    const estMinutes = this.getEstMinutesFromTimestamp(timestamp);

    // ASIAN wraps past midnight: 19:00–24:00 OR 00:00–02:00
    const inAsian = estMinutes >= KILLZONES.ASIAN.start || estMinutes < KILLZONES.ASIAN.end;
    if (inAsian) return "ASIAN";

    // Non-wrap zones: simple range check
    if (estMinutes >= KILLZONES.LONDON.start && estMinutes < KILLZONES.LONDON.end) return "LONDON";
    if (estMinutes >= KILLZONES.NEW_YORK.start && estMinutes < KILLZONES.NEW_YORK.end) return "NEW_YORK";
    if (estMinutes >= KILLZONES.LONDON_CLOSE.start && estMinutes < KILLZONES.LONDON_CLOSE.end) return "LONDON_CLOSE";
    return "NONE";
  }

  analyzeMarketStructure(candles: Candle[]): MarketStructure {
    const swingHighs = this.findSwingHighs(candles, SWING_LEFT_BARS, SWING_RIGHT_BARS);
    const swingLows = this.findSwingLows(candles, SWING_LEFT_BARS, SWING_RIGHT_BARS);
    const trend = this.analyzeTrend(swingHighs, swingLows, candles);
    let orderBlocks = this.detectOrderBlocks(candles, swingHighs, swingLows);
    let fairValueGaps = this.detectFVG(candles);
    const breakerBlocks = this.detectBreakerBlocks(orderBlocks, candles, swingHighs, swingLows);
    const keyLevels = this.identifyKeyLevels(candles, swingHighs, swingLows);
    let liquidityZones = this.detectLiquidityZones(swingHighs, swingLows);
    const candleRanges = this.analyzeCandleRanges(candles);

    fairValueGaps = this.updateMitigations(candles, fairValueGaps);
    orderBlocks = this.updateOBMitigations(candles, orderBlocks);
    liquidityZones = this.updateLiquiditySweeps(candles, liquidityZones);

    const recentPriceAction = this.classifyRecentPriceAction(candles, candleRanges);

    const malaysianSNRs = this.detectMalaysianSNRs(candles);
    const malaysianEngulfings = this.detectMalaysianEngulfings(candles);
    const malaysianTrendlines = this.detectMalaysianTrendlines(malaysianSNRs);

    return {
      swingHighs,
      swingLows,
      trend,
      orderBlocks,
      breakerBlocks,
      fairValueGaps,
      keyLevels,
      liquidityZones,
      candleRanges,
      malaysianSNRs,
      malaysianEngulfings,
      malaysianTrendlines,

      recentPriceAction,
    };
  }

  // ── Invalidation: Target Taken Before Entry ────────────────────────

  /**
   * Returns `true` if the target price (TP) was touched after the setup
   * candle (at `setupIndex`) but BEFORE price returned to the entry POI.
   * Uses the broker's spread (in points) as a tolerance buffer so that
   * a wick that is technically inside the spread is still counted as "taken".
   *
   * @param candles     Candles to scan (entry or setup timeframe)
   * @param setupIndex  Index of the candle where the setup was formed
   * @param direction   Trade direction — BUY or SELL
   * @param tp          Take-profit price
   * @param fractal     Optional FractalContext to read spread/point
   */
  public isTargetTakenBeforeEntry(
    candles: Candle[],
    setupIndex: number,
    direction: "BUY" | "SELL",
    tp: number,
    fractal?: { spread?: number; point?: number }
  ): boolean {
    if (setupIndex < 0 || setupIndex >= candles.length) return false;

    // Convert spread (in points) to a price distance.
    // spread is an integer (e.g. 10), point is the tick size (e.g. 0.00001).
    const spreadValue = (fractal?.spread || 0) * (fractal?.point || 0);

    for (let i = setupIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      // For a BUY setup, target is above — touched if wick hit TP - spread
      if (direction === "BUY" && c.high >= tp - spreadValue) return true;
      // For a SELL setup, target is below — touched if wick hit TP + spread
      if (direction === "SELL" && c.low <= tp + spreadValue) return true;
    }

    return false;
  }

  // ── Swing Detection ────────────────────────────────────────────────

  /**
   * Find swing HIGH points. A candle is a swing high if it has `leftBars`
   * lower highs to its left AND `rightBars` lower highs to its right.
   * Strength is derived from the number of surrounding bars that respect it.
   */
  findSwingHighs(candles: Candle[], leftBars = 3, rightBars = 2): SwingHigh[] {
    const swings: SwingHigh[] = [];
    const start = leftBars;
    const end = candles.length - rightBars;

    for (let i = start; i < end; i++) {
      const current = candles[i].high;

      // Check left
      let isHigh = true;
      for (let j = i - leftBars; j < i; j++) {
        if (candles[j].high >= current) {
          isHigh = false;
          break;
        }
      }
      if (!isHigh) continue;

      // Check right
      for (let j = i + 1; j <= i + rightBars; j++) {
        if (candles[j].high >= current) {
          isHigh = false;
          break;
        }
      }
      if (!isHigh) continue;

      // Strength: count how many candles on each side are strictly lower
      let strength = 0;
      for (let j = Math.max(0, i - 5); j < i; j++) {
        if (candles[j].high < current) strength++;
      }
      for (let j = i + 1; j < Math.min(candles.length, i + 5); j++) {
        if (candles[j].high < current) strength++;
      }
      strength = Math.min(5, Math.max(1, Math.ceil(strength / 2)));

      swings.push({
        index: i,
        price: current,
        time: candles[i].time,
        strength,
      });
    }

    return swings;
  }

  /**
   * Find swing LOW points — mirror of `findSwingHighs`.
   */
  findSwingLows(candles: Candle[], leftBars = 3, rightBars = 2): SwingLow[] {
    const swings: SwingLow[] = [];
    const start = leftBars;
    const end = candles.length - rightBars;

    for (let i = start; i < end; i++) {
      const current = candles[i].low;

      let isLow = true;
      for (let j = i - leftBars; j < i; j++) {
        if (candles[j].low <= current) {
          isLow = false;
          break;
        }
      }
      if (!isLow) continue;

      for (let j = i + 1; j <= i + rightBars; j++) {
        if (candles[j].low <= current) {
          isLow = false;
          break;
        }
      }
      if (!isLow) continue;

      let strength = 0;
      for (let j = Math.max(0, i - 5); j < i; j++) {
        if (candles[j].low > current) strength++;
      }
      for (let j = i + 1; j < Math.min(candles.length, i + 5); j++) {
        if (candles[j].low > current) strength++;
      }
      strength = Math.min(5, Math.max(1, Math.ceil(strength / 2)));

      swings.push({
        index: i,
        price: current,
        time: candles[i].time,
        strength,
      });
    }

    return swings;
  }

  // ── Daily Price Action (Intraday Bias) ─────────────────────────────
  
  analyzeDailyPriceAction(candles: Candle[]): Trend {
    if (candles.length < 3) return { direction: "SIDEWAYS", strength: 0 };
    
    const current = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    
    // Pure Price Action:
    // If today's close is above yesterday's high -> Strong Bullish
    if (current.close > prev.high) {
      return { direction: "BULL", strength: 80 };
    } 
    // If today's close is below yesterday's low -> Strong Bearish
    else if (current.close < prev.low) {
      return { direction: "BEAR", strength: 80 };
    } 
    // If today's close is just above yesterday's close -> Weak Bullish
    else if (current.close > prev.close) {
      return { direction: "BULL", strength: 60 };
    } 
    // If today's close is just below yesterday's close -> Weak Bearish
    else if (current.close < prev.close) {
      return { direction: "BEAR", strength: 60 };
    }
    
    return { direction: "SIDEWAYS", strength: 50 };
  }

  // ── Trend Analysis ─────────────────────────────────────────────────

  analyzeTrend(swingHighs: SwingHigh[], swingLows: SwingLow[], candles?: Candle[]): Trend {
    if (swingHighs.length < 2 || swingLows.length < 2) {
      return { direction: "SIDEWAYS", strength: 0 };
    }

    // Filter to only strong swings to avoid micro-structure fakeouts
    const majorHighs = swingHighs.filter(h => h.strength >= 3);
    const majorLows = swingLows.filter(l => l.strength >= 3);

    // If we don't have enough major swings, fall back to the raw swings
    const activeHighs = majorHighs.length >= 2 ? majorHighs : swingHighs;
    const activeLows = majorLows.length >= 2 ? majorLows : swingLows;

    const currentPrice = candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
    
    // --- TRUE SMC EXTERNAL STRUCTURE TRACKING ---
    // Combine all swings chronologically to trace the dealing range
    const allSwings = [
      ...activeHighs.map(h => ({ ...h, type: "high" })),
      ...activeLows.map(l => ({ ...l, type: "low" }))
    ].sort((a, b) => a.index - b.index);

    let direction: "BULL" | "BEAR" | "SIDEWAYS" = "SIDEWAYS";
    let strongHigh = activeHighs[0];
    let strongLow = activeLows[0];

    for (let i = 0; i < allSwings.length; i++) {
      const swing = allSwings[i];
      if (direction === "SIDEWAYS") {
        if (swing.type === "high") strongHigh = swing;
        if (swing.type === "low") strongLow = swing;
        if (strongHigh && strongLow) {
          direction = strongHigh.index > strongLow.index ? "BULL" : "BEAR";
        }
      } else if (direction === "BULL") {
        if (swing.type === "high" && swing.price > strongHigh.price) {
          // Bullish BOS (Continuation)
          const lowsBetween = activeLows.filter(l => l.index >= strongHigh.index && l.index <= swing.index);
          if (lowsBetween.length > 0) {
            strongLow = lowsBetween.reduce((min, l) => l.price < min.price ? l : min, lowsBetween[0]);
          }
          strongHigh = swing;
        } else if (swing.type === "low" && swing.price < strongLow.price) {
          // Bearish CHoCH (Trend Reversal)
          direction = "BEAR";
          const highsBetween = activeHighs.filter(h => h.index >= strongLow.index && h.index <= swing.index);
          if (highsBetween.length > 0) {
            strongHigh = highsBetween.reduce((max, h) => h.price > max.price ? h : max, highsBetween[0]);
          }
          strongLow = swing;
        }
      } else if (direction === "BEAR") {
        if (swing.type === "low" && swing.price < strongLow.price) {
          // Bearish BOS (Continuation)
          const highsBetween = activeHighs.filter(h => h.index >= strongLow.index && h.index <= swing.index);
          if (highsBetween.length > 0) {
            strongHigh = highsBetween.reduce((max, h) => h.price > max.price ? h : max, highsBetween[0]);
          }
          strongLow = swing;
        } else if (swing.type === "high" && swing.price > strongHigh.price) {
          // Bullish CHoCH (Trend Reversal)
          direction = "BULL";
          const lowsBetween = activeLows.filter(l => l.index >= strongHigh.index && l.index <= swing.index);
          if (lowsBetween.length > 0) {
            strongLow = lowsBetween.reduce((min, l) => l.price < min.price ? l : min, lowsBetween[0]);
          }
          strongHigh = swing;
        }
      }
    }

    let strength = 75; // Default strength for intact SMC structure

    // --- REAL-TIME PRICE ACTION OVERRIDE (Active BOS & Momentum) ---
    if (currentPrice > 0) {
      // 1. Structural Break (Active BOS of the TRUE Strong High/Low)
      if (currentPrice > strongHigh.price) {
        direction = "BULL";
        strength = 85;
      } else if (currentPrice < strongLow.price) {
        direction = "BEAR";
        strength = 85;
      } else if (candles && candles.length > 20) {
        // 2. Momentum Shift (Impulsive Moves inside the dealing range)
        const recentCandles = candles.slice(-4);
        let strongBearishMomentum = 0;
        let strongBullishMomentum = 0;
        
        const lookback = candles.slice(-20);
        const avgRange = lookback.reduce((sum, c) => sum + (c.high - c.low), 0) / lookback.length;

        for (const c of recentCandles) {
          const body = Math.abs(c.close - c.open);
          if (body > avgRange * 1.5) { // Increased threshold for stronger impulsive moves
            if (c.close < c.open) strongBearishMomentum++;
            else strongBullishMomentum++;
          }
        }

        if (strongBearishMomentum > 0 && strongBullishMomentum === 0) {
           // Only override if it retraced significantly from the internal high
           if (strongHigh.price - currentPrice > (currentPrice - strongLow.price)) {
               direction = "BEAR";
               strength = 70; // Momentum-driven internal shift
           }
        } else if (strongBullishMomentum > 0 && strongBearishMomentum === 0) {
           if (currentPrice - strongLow.price > (strongHigh.price - currentPrice)) {
               direction = "BULL";
               strength = 70;
           }
        }
      }
    }
        const lookback = candles.slice(-20);
        const avgRange = lookback.reduce((sum, c) => sum + (c.high - c.low), 0) / lookback.length;

        for (const c of recentCandles) {
          const body = Math.abs(c.close - c.open);
          // If the candle body is larger than the average total range
          if (body > avgRange * 1.2) {
            if (c.close < c.open) strongBearishMomentum++;
            else strongBullishMomentum++;
          }
        }

        // If there's a strong momentum shift, override the trend for intraday responsiveness
        if (strongBearishMomentum > 0 && strongBullishMomentum === 0) {
           // Require price to have retraced > 50% of the previous swing range
           if (lastHigh.price - currentPrice > (currentPrice - lastLow.price)) {
               direction = "BEAR";
               strength = 75; // Momentum-driven Bearish shift
           }
        } else if (strongBullishMomentum > 0 && strongBearishMomentum === 0) {
           if (currentPrice - lastLow.price > (lastHigh.price - currentPrice)) {
               direction = "BULL";
               strength = 75; // Momentum-driven Bullish shift
           }
        }
      }
    }

    return { direction, strength };
  }

  // ── Order Block Detection ──────────────────────────────────────────

  /**
   * Order Block = last candle BEFORE a strong impulsive move.
   * Bullish OB: last bearish (or small) candle before a strong up move
   * Bearish OB: last bullish (or small) candle before a strong down move
   *
   * "Strong" = range >= IMPULSE_THRESHOLD × average range of preceding candles.
   */
  detectOrderBlocks(
    candles: Candle[],
    swingHighs: SwingHigh[],
    swingLows: SwingLow[],
  ): OrderBlock[] {
    const blocks: OrderBlock[] = [];
    if (candles.length < 10) return blocks;

    const avgRange = this.averageRange(candles, 10);

    for (let i = 5; i < candles.length - 1; i++) {
      const current = candles[i];
      const next = candles[i + 1];
      const range = next.high - next.low;

      // Only consider strong impulsive candles
      if (range < avgRange * IMPULSE_THRESHOLD) continue;

      const isBullishMove = next.close > next.open && next.close > current.close;
      const isBearishMove = next.close < next.open && next.close < current.close;

      // Bullish OB: current candle is the "pause" before the impulse
      if (isBullishMove) {
        const obTop = Math.max(current.open, current.close);
        const obBottom = Math.min(current.open, current.close);

        blocks.push({
          index: i,
          type: "BULLISH",
          top: obTop,
          bottom: obBottom,
          time: current.time,
          mitigated: false,
          touchCount: 0,
        });
      }

      // Bearish OB
      if (isBearishMove) {
        const obTop = Math.max(current.open, current.close);
        const obBottom = Math.min(current.open, current.close);

        blocks.push({
          index: i,
          type: "BEARISH",
          top: obTop,
          bottom: obBottom,
          time: current.time,
          mitigated: false,
          touchCount: 0,
        });
      }
    }

    // Deduplicate nearby OBs
    return this.deduplicateOrderBlocks(blocks);
  }

  // ── Breaker Block Detection ────────────────────────────────────────

  /**
   * A Breaker Block forms when an Order Block is broken (price moves through
   * it) and then becomes the opposite role (former support → resistance).
   */
  detectBreakerBlocks(
    orderBlocks: OrderBlock[],
    candles: Candle[],
    swingHighs: SwingHigh[],
    swingLows: SwingLow[],
  ): BreakerBlock[] {
    const breakers: BreakerBlock[] = [];

    for (const ob of orderBlocks) {
      if (ob.type === "BULLISH") {
        // Bullish OB broken to the downside — price went below its bottom
        const broken = candles.slice(ob.index).some((c) => c.low < ob.bottom);
        if (broken) {
          // The OB level flips to resistance
          breakers.push({
            orderBlock: ob,
            brokenDirection: "BEAR",
            flippedLevel: ob.bottom,
            time: ob.time,
          });
        }
      } else {
        // Bearish OB broken to the upside
        const broken = candles.slice(ob.index).some((c) => c.high > ob.top);
        if (broken) {
          breakers.push({
            orderBlock: ob,
            brokenDirection: "BULL",
            flippedLevel: ob.top,
            time: ob.time,
          });
        }
      }
    }

    return breakers;
  }

  // ── Fair Value Gap (FVG) Detection ─────────────────────────────────

  /**
   * Three‑candle imbalance (FVG):
   *
   *   BULLISH FVG: candle[2].low > candle[0].high
   *     ┌───┐
   *     │ 2 │  ← low of candle 2 > high of candle 0
   *   ┌─┴─┴─┘
   *   │   │       ← gap
   * ┌─┴───┴──┐
   * │   0    │
   * └────────┘
   *
   *   BEARISH FVG: candle[2].high < candle[0].low
   */
  detectFVG(candles: Candle[], bodyOnly = FVG_BODY_ONLY): FVG[] {
    const gaps: FVG[] = [];
    if (candles.length < 3) return gaps;

    for (let i = 0; i < candles.length - 2; i++) {
      const c0 = candles[i];
      const c2 = candles[i + 2];

      if (bodyOnly) {
        // Use body (open/close) for gap detection
        const c0BodyTop = Math.max(c0.open, c0.close);
        const c0BodyBottom = Math.min(c0.open, c0.close);
        const c2BodyTop = Math.max(c2.open, c2.close);
        const c2BodyBottom = Math.min(c2.open, c2.close);

        // Bullish FVG: candle 2 body bottom > candle 0 body top
        if (c2BodyBottom > c0BodyTop) {
          gaps.push({
            index: i + 1,
            type: "BULLISH",
            top: c2BodyBottom,
            bottom: c0BodyTop,
            mitigated: false,
            time: candles[i + 1].time,
          });
          continue;
        }

        // Bearish FVG: candle 2 body top < candle 0 body bottom
        if (c2BodyTop < c0BodyBottom) {
          gaps.push({
            index: i + 1,
            type: "BEARISH",
            top: c0BodyBottom,
            bottom: c2BodyTop,
            mitigated: false,
            time: candles[i + 1].time,
          });
          continue;
        }
      } else {
        // Use wicks (high/low) for gap detection
        if (c2.low > c0.high) {
          gaps.push({
            index: i + 1,
            type: "BULLISH",
            top: c2.low,
            bottom: c0.high,
            mitigated: false,
            time: candles[i + 1].time,
          });
          continue;
        }

        if (c2.high < c0.low) {
          gaps.push({
            index: i + 1,
            type: "BEARISH",
            top: c0.low,
            bottom: c2.high,
            mitigated: false,
            time: candles[i + 1].time,
          });
          continue;
        }
      }
    }

    return gaps;
  }

  // ── Key Level Identification (MSNR Style) ─────────────────────────

  /**
   * Cluster swing highs/lows into key support/resistance levels.
   * Levels within tolerance are merged into a weighted average.
   * Strength = number of swing points in the cluster + how recently.
   */
  identifyKeyLevels(
    candles: Candle[],
    swingHighs: SwingHigh[],
    swingLows: SwingLow[],
    tolerancePct = LEVEL_CLUSTER_TOLERANCE_PCT,
  ): KeyLevel[] {
    const lastTime = candles.length > 0 ? candles[candles.length - 1].time : 0;

    // Collect all swing points into a unified list with type
    const points: Array<{ price: number; type: "SUPPORT" | "RESISTANCE"; time: number }> = [
      ...swingHighs.map((s) => ({ price: s.price, type: "RESISTANCE" as const, time: s.time })),
      ...swingLows.map((s) => ({ price: s.price, type: "SUPPORT" as const, time: s.time })),
    ];

    if (points.length === 0) return [];

    // Sort by price
    points.sort((a, b) => a.price - b.price);

    // 1D Density Clustering (DBSCAN approach)
    // Epsilon is dynamic based on average price to account for different symbol pricing scales
    const avgPriceAll = points.reduce((sum, p) => sum + p.price, 0) / points.length;
    const eps = avgPriceAll * tolerancePct;
    const minPoints = 1;

    const clusters: Array<typeof points> = [];
    const visited = new Set<number>();

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;

      const cluster: typeof points = [];
      const queue = [i];
      visited.add(i);

      while (queue.length > 0) {
        const currIdx = queue.shift()!;
        cluster.push(points[currIdx]);

        // Find all points within epsilon distance
        for (let j = 0; j < points.length; j++) {
          if (visited.has(j)) continue;
          if (Math.abs(points[currIdx].price - points[j].price) <= eps) {
            visited.add(j);
            queue.push(j);
          }
        }
      }

      if (cluster.length >= minPoints) {
        clusters.push(cluster);
      }
    }

    const levels: KeyLevel[] = clusters.map((cluster) => {
      // Calculate weighted average price
      const avgPrice = cluster.reduce((sum, p) => sum + p.price, 0) / cluster.length;

      // Determine type by majority
      const supports = cluster.filter((p) => p.type === "SUPPORT").length;
      const resistances = cluster.filter((p) => p.type === "RESISTANCE").length;
      const type: "SUPPORT" | "RESISTANCE" = supports >= resistances ? "SUPPORT" : "RESISTANCE";

      // Strength: number of points + recency bonus
      const recencyBonus = cluster.filter(
        (p) => p.time > lastTime - 7 * 24 * 3600, // within last 7 days
      ).length;
      const strength = Math.min(5, Math.max(1, Math.ceil(cluster.length / 2) + recencyBonus));

      const lastTested = Math.max(...cluster.map((p) => p.time));

      return {
        price: Math.round(avgPrice * 100000) / 100000,
        type,
        strength,
        lastTested,
      };
    });

    // Sort by strength desc, then take top 20
    return levels
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 20)
      .sort((a, b) => a.price - b.price);
  }

  // ── Liquidity Zone Detection (LIT Style) ───────────────────────────

  /**
   * Liquidity clusters form at swing highs (where buy‑side stops sit)
   * and swing lows (where sell‑side stops sit). The more swing points
   * within a price tolerance, the denser the liquidity.
   */
  detectLiquidityZones(swingHighs: SwingHigh[], swingLows: SwingLow[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    const tolerancePct = LEVEL_CLUSTER_TOLERANCE_PCT;

    // Process swing highs → buy‑side liquidity (stops above)
    const highPrices = swingHighs.map((s) => s.price);
    const highClusters = this.clusterPrices(highPrices, tolerancePct);

    for (const cluster of highClusters) {
      zones.push({
        price: cluster.avg,
        type: "BUY_SIDE",
        density: cluster.indices.length,
        swingIndices: cluster.indices,
        swept: false,
      });
    }

    // Process swing lows → sell‑side liquidity (stops below)
    const lowPrices = swingLows.map((s) => s.price);
    const lowClusters = this.clusterPrices(lowPrices, tolerancePct);

    for (const cluster of lowClusters) {
      zones.push({
        price: cluster.avg,
        type: "SELL_SIDE",
        density: cluster.indices.length,
        swingIndices: cluster.indices,
        swept: false,
      });
    }

    // Sort by density desc, top 10
    return zones.sort((a, b) => b.density - a.density).slice(0, 10);
  }

  // ── Candle Range Analysis (CRT Style) ──────────────────────────────

  analyzeCandleRanges(candles: Candle[], lookback = 20): CandleRangeAnalysis {
    const recent = candles.slice(-lookback);
    if (recent.length === 0) {
      return {
        high: 0,
        low: 0,
        width: 0,
        averageBody: 0,
        averageWickTop: 0,
        averageWickBottom: 0,
        recentDisplacement: false,
      };
    }

    const high = Math.max(...recent.map((c) => c.high));
    const low = Math.min(...recent.map((c) => c.low));

    // Average body size
    const bodies = recent.map((c) => Math.abs(c.close - c.open));
    const averageBody = bodies.reduce((s, b) => s + b, 0) / bodies.length;

    // Average wick sizes
    const wickTops = recent.map((c) => c.high - Math.max(c.open, c.close));
    const wickBottoms = recent.map((c) => Math.min(c.open, c.close) - c.low);
    const averageWickTop = wickTops.reduce((s, w) => s + w, 0) / wickTops.length;
    const averageWickBottom = wickBottoms.reduce((s, w) => s + w, 0) / wickBottoms.length;

    // Displacement: last candle range >= 2× average of previous 5
    const last5 = recent.slice(-6, -1);
    const avgPrevRange = last5.length > 0
      ? last5.reduce((s, c) => s + (c.high - c.low), 0) / last5.length
      : 0;
    const lastRange = recent[recent.length - 1].high - recent[recent.length - 1].low;
    const recentDisplacement = avgPrevRange > 0 && lastRange >= avgPrevRange * 2;

    return {
      high,
      low,
      width: high - low,
      averageBody,
      averageWickTop,
      averageWickBottom,
      recentDisplacement,
    };
  }



  // ── Price Action Classification ────────────────────────────────────

  classifyRecentPriceAction(
    candles: Candle[],
    ranges: CandleRangeAnalysis,
    lookback = 10,
  ): MarketStructure["recentPriceAction"] {
    const recent = candles.slice(-lookback);
    if (recent.length < 3) return "RANGING";

    // Check displacement first
    if (ranges.recentDisplacement) {
      const last = recent[recent.length - 1];
      if (last.close > last.open && last.close > recent[recent.length - 2].high) {
        return "EXPANSION_BULL";
      }
      if (last.close < last.open && last.close < recent[recent.length - 2].low) {
        return "EXPANSION_BEAR";
      }
    }

    // Check contraction
    const ranges_list = recent.map((c) => c.high - c.low);
    const avgRecent = ranges_list.reduce((s, r) => s + r, 0) / ranges_list.length;
    const earlyRanges = ranges_list.slice(0, 5);
    const avgEarly = earlyRanges.reduce((s, r) => s + r, 0) / earlyRanges.length;

    if (avgEarly > 0 && avgRecent < avgEarly * 0.6) {
      return "CONTRACTION";
    }

    return "RANGING";
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private averageRange(candles: Candle[], period: number): number {
    const recent = candles.slice(-period);
    if (recent.length === 0) return 0;
    return recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  }

  private clusterPrices(prices: number[], tolerancePct: number): Array<{ avg: number; indices: number[] }> {
    const sorted = [...prices].sort((a, b) => a - b);
    const clusters: Array<{ avg: number; indices: number[] }> = [];
    const used = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;
      const cluster: number[] = [sorted[i]];
      used.add(i);

      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(sorted[j] - sorted[i]) / sorted[i] <= tolerancePct) {
          cluster.push(sorted[j]);
          used.add(j);
        }
      }

      clusters.push({
        avg: cluster.reduce((s, p) => s + p, 0) / cluster.length,
        indices: cluster.map((_, idx) => i + idx),
      });
    }

    return clusters;
  }

  updateOBMitigations(candles: Candle[], obs: OrderBlock[]): OrderBlock[] {
    return obs.map((ob) => {
        if (ob.mitigated) return ob;
        const subsequentCandles = candles.slice(ob.index + 1);
        let mitigated = false;
        let touchCount = 0;
        
        for (const c of subsequentCandles) {
            if (ob.type === "BULLISH") {
                if (c.low <= ob.top) touchCount++;
                if (c.close < ob.bottom) { mitigated = true; break; }
            } else {
                if (c.high >= ob.bottom) touchCount++;
                if (c.close > ob.top) { mitigated = true; break; }
            }
        }
        return { ...ob, mitigated, touchCount };
    });
  }

  updateLiquiditySweeps(candles: Candle[], zones: LiquidityZone[]): LiquidityZone[] {
    return zones.map(lz => {
        if (lz.swept) return lz;
        const lastSwingIndex = Math.max(...lz.swingIndices);
        const subsequentCandles = candles.slice(lastSwingIndex + 1);
        let swept = false;
        
        for (const c of subsequentCandles) {
            if (lz.type === "BUY_SIDE" && c.high > lz.price) { swept = true; break; }
            if (lz.type === "SELL_SIDE" && c.low < lz.price) { swept = true; break; }
        }
        return { ...lz, swept };
    });
  }

  /**
   * Mark FVGs as mitigated if price has since filled the gap.
   * Also mark them as inverted (IFVG) if price closes decisively through them.
   */
  updateMitigations(candles: Candle[], fvgs: FVG[]): FVG[] {
    return fvgs.map((fvg) => {
      // If already mitigated and inverted, no need to check further
      if (fvg.mitigated && fvg.inverted) return fvg;

      const subsequentCandles = candles.slice(fvg.index + 2);
      let mitigated = fvg.mitigated;
      let inverted = fvg.inverted || false;
      let invertedTime = fvg.invertedTime;

      for (const c of subsequentCandles) {
        if (fvg.type === "BULLISH") {
          // Price dipped into the gap (mitigation)
          if (!mitigated && c.low <= fvg.top) {
            mitigated = true;
          }
          // Price closed decisively below the gap (inversion)
          if (!inverted && c.close < fvg.bottom) {
            inverted = true;
            invertedTime = c.time;
            mitigated = true; // Inversion inherently means it was fully mitigated
          }
        } else {
          // Price rose into the gap (mitigation)
          if (!mitigated && c.high >= fvg.bottom) {
            mitigated = true;
          }
          // Price closed decisively above the gap (inversion)
          if (!inverted && c.close > fvg.top) {
            inverted = true;
            invertedTime = c.time;
            mitigated = true;
          }
        }
      }

      return { ...fvg, mitigated, inverted, invertedTime };
    });
  }

  private deduplicateOrderBlocks(blocks: OrderBlock[]): OrderBlock[] {
    if (blocks.length <= 1) return blocks;

    const merged: OrderBlock[] = [];
    const sorted = [...blocks].sort((a, b) => a.index - b.index);

    for (const block of sorted) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(block.index - last.index) <= 2) {
        // Merge: keep the wider range
        last.top = Math.max(last.top, block.top);
        last.bottom = Math.min(last.bottom, block.bottom);
        last.touchCount += block.touchCount;
      } else {
        merged.push({ ...block });
      }
    }

    return merged;
  }
  // ── Malaysian SNR (Body-based) ──────────────────────────────────────

  /**
   * Detects A-shapes (Resistance) and V-shapes (Support) based on Open/Close prices.
   * Resistance: Bullish close followed by Bearish open at the same level.
   * Support: Bearish close followed by Bullish open at the same level.
   * Also tracks "Freshness" and "Misses".
   */
  detectMalaysianSNRs(candles: Candle[]): MalaysianSNR[] {
    const snrs: MalaysianSNR[] = [];
    if (candles.length < 3) return snrs;

    for (let i = 1; i < candles.length - 1; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      const next = candles[i + 1];

      const prevBodyDir = prev.close > prev.open ? "BULL" : (prev.close < prev.open ? "BEAR" : "DOJI");
      const currBodyDir = curr.close > curr.open ? "BULL" : (curr.close < curr.open ? "BEAR" : "DOJI");

      // Tolerance is now ZONE-BASED: current candle's open must be within ±30% of previous candle's BODY size.
      // This is realistic for OHLC data where open ≠ previous close due to spreads/gaps.
      // Example: if previous bullish body = 200 pips, open can be within ±60 pips (30% of body) of prev.close.
      const prevBodySize = Math.abs(prev.close - prev.open);
      // Minimum tolerance: 20% of previous close (1/5 of a pip for tight assets)
      const priceTolerance = Math.max(curr.close * 0.001, prevBodySize * 0.30);

      // A-Shape (Resistance): Bullish prev candle -> Bearish curr candle
      // curr.open must be near prev.close (within tolerance)
      // AND curr candle must NOT break above prev.close (otherwise it's a breakout, not SNR)
      if (prevBodyDir === "BULL" && currBodyDir === "BEAR"
        && Math.abs(prev.close - curr.open) <= priceTolerance
        && curr.close < prev.close // bearish reaction confirms resistance
      ) {
        snrs.push({
          price: prev.close,
          type: "RESISTANCE",
          time: curr.time,
          index: i,
          isFresh: true,
          touchedByWick: false,
          brokenByBody: false,
          missed: false,
        });
      }

      // V-Shape (Support): Bearish prev candle -> Bullish curr candle
      // curr.open must be near prev.close (within tolerance)
      // AND curr candle must close above prev.close (bullish reaction confirms support)
      if (prevBodyDir === "BEAR" && currBodyDir === "BULL"
        && Math.abs(prev.close - curr.open) <= priceTolerance
        && curr.close > prev.close // bullish reaction confirms support
      ) {
        snrs.push({
          price: prev.close,
          type: "SUPPORT",
          time: curr.time,
          index: i,
          isFresh: true,
          touchedByWick: false,
          brokenByBody: false,
          missed: false,
        });
      }
    }

    // Update Freshness and Misses for all detected SNRs
    this.updateSNRFreshness(snrs, candles);

    return snrs;
  }

  private updateSNRFreshness(snrs: MalaysianSNR[], candles: Candle[]) {
    for (const snr of snrs) {
      let missed = false;
      let touched = false;
      
      // Start checking from the candle after the SNR formed
      for (let j = snr.index + 1; j < candles.length; j++) {
        const c = candles[j];
        
        // 1. Check for body break (Breakout validates it as Fresh again, or creates a Flipped SNR)
        if (snr.type === "RESISTANCE" && Math.min(c.open, c.close) > snr.price) {
            snr.brokenByBody = true;
            snr.isFresh = true; // Broken by body makes it fresh for support
            snr.type = "SUPPORT"; // Flipped SNR
            continue;
        }
        if (snr.type === "SUPPORT" && Math.max(c.open, c.close) < snr.price) {
            snr.brokenByBody = true;
            snr.isFresh = true;
            snr.type = "RESISTANCE"; // Flipped SNR
            continue;
        }

        // 2. Check for wick touch
        const wickHigh = c.high;
        const wickLow = c.low;

        // If it was broken by body, we evaluate touches based on its NEW type
        if (snr.type === "RESISTANCE" && wickHigh >= snr.price) {
          snr.touchedByWick = true;
          snr.isFresh = false; // Once touched by wick, it's unfresh
          touched = true;
        }
        if (snr.type === "SUPPORT" && wickLow <= snr.price) {
          snr.touchedByWick = true;
          snr.isFresh = false;
          touched = true;
        }

        // 3. Check for Miss (price comes close but wick fails to touch)
        // A Miss validates the SNR. Let's say within 1 ATR but no touch.
        // Simplified: if it hasn't been touched yet, but subsequent candles form away from it, it's missed.
        if (!touched && (j > snr.index + 2)) {
            snr.missed = true;
        }
      }
    }
  }

  /**
   * Strict Engulfing: 2nd candle body COMPLETELY engulfs 1st candle body.
   */
  detectMalaysianEngulfings(candles: Candle[]): MalaysianEngulfing[] {
    const engulfings: MalaysianEngulfing[] = [];
    if (candles.length < 2) return engulfings;

    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];

      const prevTop = Math.max(prev.open, prev.close);
      const prevBottom = Math.min(prev.open, prev.close);
      const currTop = Math.max(curr.open, curr.close);
      const currBottom = Math.min(curr.open, curr.close);

      // Bullish Engulfing
      if (prev.close < prev.open && curr.close > curr.open) { // Prev Bear, Curr Bull
        if (currTop >= prevTop && currBottom <= prevBottom) {
          engulfings.push({
            type: "BULLISH",
            top: currTop,
            bottom: currBottom,
            time: curr.time,
            index: i,
          });
        }
      }

      // Bearish Engulfing
      if (prev.close > prev.open && curr.close < curr.open) { // Prev Bull, Curr Bear
        if (currTop >= prevTop && currBottom <= prevBottom) {
          engulfings.push({
            type: "BEARISH",
            top: currTop,
            bottom: currBottom,
            time: curr.time,
            index: i,
          });
        }
      }
    }
    return engulfings;
  }

  /**
   * Trendline: connects at least 2 SNRs of the same type.
   * Resistance TL: connects Resistance SNRs downwards.
   * Support TL: connects Support SNRs upwards.
   */
  detectMalaysianTrendlines(snrs: MalaysianSNR[]): MalaysianTrendline[] {
    const trendlines: MalaysianTrendline[] = [];
    const supports = snrs.filter(s => s.type === "SUPPORT");
    const resistances = snrs.filter(s => s.type === "RESISTANCE");

    // Very basic naive trendline builder: just connect the last 2 valid points
    // A proper trendline builder would require more complex raycasting.
    // For now, let's just connect recent consecutive SNRs that form a trend.

    // Support Trendline (higher lows)
    for (let i = 0; i < supports.length - 1; i++) {
        for (let j = i + 1; j < supports.length; j++) {
            const p1 = supports[i];
            const p2 = supports[j];
            if (p2.price > p1.price && p2.index > p1.index) {
                // Upward slope
                const slope = (p2.price - p1.price) / (p2.index - p1.index);
                trendlines.push({ p1, p2, type: "SUPPORT", slope });
            }
        }
    }

    // Resistance Trendline (lower highs)
    for (let i = 0; i < resistances.length - 1; i++) {
        for (let j = i + 1; j < resistances.length; j++) {
            const p1 = resistances[i];
            const p2 = resistances[j];
            if (p2.price < p1.price && p2.index > p1.index) {
                // Downward slope
                const slope = (p2.price - p1.price) / (p2.index - p1.index);
                trendlines.push({ p1, p2, type: "RESISTANCE", slope });
            }
        }
    }

    return trendlines;
  }

  /**
   * Determine a structural Take Profit (TP) based on HTF structure.
   * Finds the nearest major liquidity zone, unmitigated OB, unfilled FVG, or swing point.
   */
  findDynamicTarget(
    direction: "BUY" | "SELL",
    entryPrice: number,
    slPrice: number,
    htfStr: MarketStructure,
    minRR: number = 2.0
  ): number {
    const risk = Math.abs(entryPrice - slPrice);
    const minTargetDist = risk * minRR;
    const minTargetPrice = direction === "BUY" ? entryPrice + minTargetDist : entryPrice - minTargetDist;

    let structuralTarget: number | null = null;
    let closestDist = Infinity;

    // Helper to evaluate a potential target level
    const evaluateLevel = (price: number) => {
        if (direction === "BUY") {
            if (price > entryPrice && price >= minTargetPrice) {
                const dist = price - entryPrice;
                if (dist < closestDist) {
                    closestDist = dist;
                    structuralTarget = price;
                }
            }
        } else {
            if (price < entryPrice && price <= minTargetPrice) {
                const dist = entryPrice - price;
                if (dist < closestDist) {
                    closestDist = dist;
                    structuralTarget = price;
                }
            }
        }
    };

    // 1. Check Swing Points (Liquidity Pools)
    if (direction === "BUY") {
        htfStr.swingHighs.forEach(sh => evaluateLevel(sh.price));
    } else {
        htfStr.swingLows.forEach(sl => evaluateLevel(sl.price));
    }

    // 2. Check Order Blocks (opposite direction of our trade)
    htfStr.orderBlocks.forEach(ob => {
        if (!ob.mitigated) {
            if (direction === "BUY" && ob.type === "BEARISH") evaluateLevel(ob.bottom);
            if (direction === "SELL" && ob.type === "BULLISH") evaluateLevel(ob.top);
        }
    });

    // 3. Check FVGs (opposite direction)
    htfStr.fairValueGaps.forEach(fvg => {
        if (!fvg.mitigated) {
            if (direction === "BUY" && fvg.type === "BEARISH") evaluateLevel(fvg.bottom);
            if (direction === "SELL" && fvg.type === "BULLISH") evaluateLevel(fvg.top);
        }
    });

    // 4. Check Liquidity Zones
    htfStr.liquidityZones.forEach(lz => {
        if (!lz.swept) {
            if (direction === "BUY" && lz.type === "BUY_SIDE") evaluateLevel(lz.price);
            if (direction === "SELL" && lz.type === "SELL_SIDE") evaluateLevel(lz.price);
        }
    });

    // Fallback: If no structural target found that satisfies Min RR, just use Min RR target.
    // Also, if the structural target is TOO far (e.g. > 5 RR), we might want to cap it, but for now we let it ride.
    if (structuralTarget !== null) {
        return structuralTarget;
    }

    return minTargetPrice; // Fallback to 1:minRR mathematically
  }
}

export const marketStructureService = new MarketStructureService();
