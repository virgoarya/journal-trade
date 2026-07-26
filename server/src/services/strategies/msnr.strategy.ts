// ─── Malaysian Support & Resistance (MSNR) + ICT Hybrid Strategy ──────────────
// Custom Edge: SNR Level -> Liquidity Inducement Grab (Turtle Soup) -> MSS -> Entry on OB
// Flow:
// 1. Identify HTF SNR (Malaysian body-based)
// 2. Identify if recent HTF price tapped SNR AND swept a liquidity pool (Swing High/Low) with a wick rejection.
// 3. If HTF Turtle Soup is valid, scan LTF for a Market Structure Shift (MSS) reversing away from the SNR.
// 4. After MSS, find a valid LTF Order Block (OB).
// 5. Place PENDING_LIMIT entry at the OB.

import { type Candle, type MalaysianSNR, type OrderBlock, type SwingHigh, type SwingLow, type MarketStructure, type FractalContext } from "./market-structure.service";
import { marketStructureService } from "./market-structure.service";
import { atrService } from "./atr.service";
import { strategyConfigService } from "./strategy-config.service";
import type { ChecklistItem } from "./confluence-engine";
import type { IPDAContext } from "./ipda-context";

export interface MSNRSignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  orderType: "MARKET" | "PENDING_LIMIT";
  limitPrice?: number;
  signalType: "TURTLE_SOUP_OB" | "TURTLE_SOUP_CISD";
  reason: string;
  checklistItems?: ChecklistItem[];
}

export interface MSNRAnalysis {
  signal: MSNRSignal | null;
  signals: MSNRSignal[];
}

class MSNRStrategy {
  analyze(fractal: FractalContext, ipda?: IPDAContext): MSNRSignal[] {
    const signals: MSNRSignal[] = [];
    if (!fractal.isAligned) return signals;

    const msnrConfig = strategyConfigService.getMSNRConfig();
    const htfCandles = fractal.setup;
    const htfStr = fractal.setupStr;
    const ltfCandles = fractal.entry;
    const ltfStr = fractal.entryStr;

    if (htfCandles.length < 5 || ltfCandles.length < 5) return signals;

    const ltfAtr = atrService.calculate(ltfCandles) || (Math.abs(ltfCandles[ltfCandles.length - 1].high - ltfCandles[ltfCandles.length - 1].low));

    // ─── STEP 1 & 2: HTF SNR + Turtle Soup (Liquidity Sweep + Rejection) ──────
    
    // Find active HTF Zones where a Turtle Soup just occurred
    const activeHtfSetups: { direction: "BUY" | "SELL", snr: MalaysianSNR, sweepLevel: number }[] = [];

    // Look at the last 2 HTF candles for a sweep & rejection
    const recentHtfCandles = htfCandles.slice(-2);
    
    for (const c of recentHtfCandles) {
        // For BUY: We need price to sweep a recent Swing Low, tap into a Support SNR, and close above both.
        const sweptLows = htfStr.swingLows.filter(sl => c.low < sl.price && c.close > sl.price);
        if (sweptLows.length > 0) {
            for (const snr of htfStr.malaysianSNRs.filter(s => s.type === "SUPPORT")) {
                // Must wick below or exactly tap, and body must close above
                if (c.low <= snr.price && Math.min(c.open, c.close) > snr.price) {
                    activeHtfSetups.push({ direction: "BUY", snr, sweepLevel: sweptLows[0].price });
                    break;
                }
            }
        }

        // For SELL: Sweep Swing High, tap Resistance SNR, close below
        const sweptHighs = htfStr.swingHighs.filter(sh => c.high > sh.price && c.close < sh.price);
        if (sweptHighs.length > 0) {
            for (const snr of htfStr.malaysianSNRs.filter(s => s.type === "RESISTANCE")) {
                if (c.high >= snr.price && Math.max(c.open, c.close) < snr.price) {
                    activeHtfSetups.push({ direction: "SELL", snr, sweepLevel: sweptHighs[0].price });
                    break;
                }
            }
        }
    }

    // Deduplicate setups
    const uniqueSetups = activeHtfSetups.filter((v, i, a) => a.findIndex(t => (t.direction === v.direction && t.snr.price === v.snr.price)) === i);

    // ─── STEP 3 & 4: LTF MSS + OB ─────────────────────────────────────────────

    for (const setup of uniqueSetups) {
        const isBuy = setup.direction === "BUY";

        let mssFound = false;
        let mssIndex = -1;
        let mssPrice = 0;

        if (isBuy) {
            // Find a recent LTF Swing High broken by a bullish candle body
            const recentLtfHighs = ltfStr.swingHighs.slice(-4); 
            for (const high of recentLtfHighs) {
                const breakoutCandles = ltfCandles.slice(high.index + 1);
                for (let i = 0; i < breakoutCandles.length; i++) {
                    const bc = breakoutCandles[i];
                    if (bc.close > high.price && bc.close > bc.open) { 
                        mssFound = true;
                        mssIndex = high.index + 1 + i; 
                        mssPrice = high.price;
                        break;
                    }
                }
                if (mssFound) break;
            }
        } else {
            // Find a recent LTF Swing Low broken by a bearish candle body
            const recentLtfLows = ltfStr.swingLows.slice(-4);
            for (const low of recentLtfLows) {
                const breakoutCandles = ltfCandles.slice(low.index + 1);
                for (let i = 0; i < breakoutCandles.length; i++) {
                    const bc = breakoutCandles[i];
                    if (bc.close < low.price && bc.close < bc.open) { 
                        mssFound = true;
                        mssIndex = low.index + 1 + i;
                        mssPrice = low.price;
                        break;
                    }
                }
                if (mssFound) break;
            }
        }

        if (!mssFound) continue;

        // Find LTF Order Block formed BEFORE or DURING the MSS
        const validOBs = ltfStr.orderBlocks.filter(ob => {
            if (isBuy && ob.type !== "BULLISH") return false;
            if (!isBuy && ob.type !== "BEARISH") return false;
            if (ob.index > mssIndex) return false;
            if (mssIndex - ob.index > 30) return false; // OB shouldn't be too old
            return true;
        });

        if (validOBs.length === 0) continue;

        // Choose the best OB. 
        // For BUY, we want the most discounted OB (lowest). For SELL, most premium OB (highest).
        const bestOB = validOBs.sort((a, b) => isBuy ? a.bottom - b.bottom : b.top - a.top)[0];

        // ─── STEP 5: ENTRY (PENDING LIMIT) ────────────────────────────────────
        
        // Wait for price to pullback to OB
        const entryPrice = isBuy ? bestOB.top : bestOB.bottom;
        const slPrice = isBuy ? bestOB.bottom - ltfAtr * 0.5 : bestOB.top + ltfAtr * 0.5;
        
        const lastLtf = ltfCandles[ltfCandles.length - 1];
        
        // Ensure the setup isn't invalidated (price smashed SL of OB before we could enter)
        if (isBuy && lastLtf.close < slPrice) continue;
        if (!isBuy && lastLtf.close > slPrice) continue;

        const reason = `MSNR Hybrid ${setup.direction}: HTF Sweep (${setup.sweepLevel.toFixed(5)}) at SNR (${setup.snr.price.toFixed(5)}) -> LTF MSS (${mssPrice.toFixed(5)}) -> OB Limit`;
        
        signals.push(this.buildSignal(setup.direction, entryPrice, slPrice, "TURTLE_SOUP_OB", reason, msnrConfig, fractal, 15));
    }

    // ── IPDA Context: daily bias filter for Turtle Soup ──
    if (ipda && signals.length > 0 && ipda.dailyBias.bias !== "SIDEWAYS") {
      for (const sig of signals) {
        const aligned = (sig.direction === "BUY" && ipda.dailyBias.bias === "BULLISH") ||
                        (sig.direction === "SELL" && ipda.dailyBias.bias === "BEARISH");
        if (!aligned) sig.confidence = Math.round(sig.confidence * 0.6);
        else sig.confidence = Math.min(95, Math.round(sig.confidence * 1.1));
      }
    }

    // ── Invalidation: remove setups where TP was hit before entry ────
    const nonInvalidatedSignals = signals.filter(sig => {
      const setupIdx = ltfCandles.length - 1;
      return !marketStructureService.isTargetTakenBeforeEntry(
        ltfCandles,
        setupIdx,
        sig.direction,
        sig.tp,
        fractal,
      );
    });

    const validSignals = nonInvalidatedSignals.filter(sig => {
      const slDist = Math.abs(sig.entry - sig.sl);
      const tpDist = Math.abs(sig.tp - sig.entry);
      if (slDist <= 0) return false;
      const rr = tpDist / slDist;
      return rr >= 2.0;
    });

    if (validSignals.length === 0) {
      const htfStr = fractal.dailyStr || fractal.directionStr;
      const dummyDir = htfStr.trend.direction === "BULL" ? "BUY" : "SELL";
      validSignals.push({
        direction: dummyDir,
        confidence: 0,
        entry: 0,
        sl: 0,
        tp: 0,
        orderType: "PENDING_LIMIT",
        signalType: "TURTLE_SOUP_OB",
        reason: "Scanning for setups...",
        checklistItems: []
      });
    }

    for (let i = validSignals.length - 1; i >= 0; i--) {
      const sig = validSignals[i];
      if (sig.confidence > 0) {
        const validation = this.buildMSNRChecklist(sig, fractal);
        sig.checklistItems = validation.items;
        
        if (!validation.passed) {
          validSignals.splice(i, 1);
        }
      }
    }

    return validSignals.sort((a, b) => b.confidence - a.confidence);
  }

  private buildSignal(direction: "BUY"|"SELL", limitPrice: number, slPrice: number, type: any, reason: string, config: any, fractal: import("./market-structure.service").FractalContext, confBoost = 0): MSNRSignal {
      const htfStr = fractal.dailyStr || fractal.directionStr;
      const tp = marketStructureService.findDynamicTarget(direction, limitPrice, slPrice, htfStr, 2.5); // Minimum 1:2.5 RR

      const sig: MSNRSignal = {
          direction,
          entry: limitPrice,
          sl: slPrice,
          tp,
          orderType: "PENDING_LIMIT",
          limitPrice,
          signalType: type,
          confidence: Math.min(95, (config.minConfidence ?? 50) + 15 + confBoost), // high confidence setup
          reason
      };
      return sig;
  }

  private buildMSNRChecklist(sig: MSNRSignal, fractal?: import("./market-structure.service").FractalContext): { items: ChecklistItem[], passed: boolean } {
    const isBuy = sig.direction === "BUY";
    const snrType = isBuy ? "Support (Body-based)" : "Resistance (Body-based)";

    const slDist = Math.abs(sig.entry - sig.sl);
    const tpDist = Math.abs(sig.tp - sig.entry);
    const rrRatio = slDist > 0 ? tpDist / slDist : 0;
    const isRRValid = rrRatio >= 2.0;

    const setupTfLabel = fractal?.setupTimeframeStr || "H1";
    const htfTfLabel = fractal?.directionTimeframeStr || "H4";
    const entryTfLabel = fractal?.entryTimeframeStr || "M15";
    
    const dailyDirection = fractal?.dailyStr?.trend.direction || "SIDEWAYS";

    // Extract dynamic prices
    const relHigh = fractal && fractal.directionStr.swingHighs.length > 0 ? fractal.directionStr.swingHighs[fractal.directionStr.swingHighs.length - 1].price.toFixed(5) : "N/A";
    const relLow = fractal && fractal.directionStr.swingLows.length > 0 ? fractal.directionStr.swingLows[fractal.directionStr.swingLows.length - 1].price.toFixed(5) : "N/A";

    const htfStr = fractal?.dailyStr || fractal?.directionStr;
    const isHtfBosConfirmed = htfStr ? (isBuy ? htfStr.trend.direction === "BULL" : htfStr.trend.direction === "BEAR") : false;

    // MSNR signal types: "TURTLE_SOUP_OB" or "TURTLE_SOUP_CISD"
    const step1 = isHtfBosConfirmed;
    const step2 = sig.confidence >= 50; // SNR zone detected
    const step3 = sig.signalType.includes("TURTLE_SOUP"); // Turtle Soup pattern confirmed
    const step4 = sig.signalType.includes("OB") || sig.signalType.includes("CISD"); // LTF MSS + OB/CISD
    const step5 = isRRValid;

    // Cascading waterfall
    const s = (stepPassed: boolean, priorAllPassed: boolean, isFailable?: boolean): "PASSED" | "WAITING" | "FAILED" => {
      if (!priorAllPassed) return "WAITING";
      if (isFailable && !stepPassed) return "FAILED";
      return stepPassed ? "PASSED" : "WAITING";
    };

    const stat1 = s(step1, true, true);
    const stat2 = s(step2, step1);
    const stat3 = s(step3, step1 && step2);
    const stat4 = s(step4, step1 && step2 && step3);
    const stat5 = s(step5, step1 && step2 && step3 && step4, true);

    const passed = stat1 !== "FAILED" && stat5 !== "FAILED";

    const items: ChecklistItem[] = [
      {
        id: "msnr-daily",
        label: `Daily Direction : ${dailyDirection === "BULL" ? "Bullish" : dailyDirection === "BEAR" ? "Bearish" : "Sideways"}`,
        status: dailyDirection !== "SIDEWAYS" ? "PASSED" : "WAITING",
        timeframe: "D1",
      },
      {
        id: "msnr-bos",
        label: `${htfTfLabel} Break Of Structure ${htfStr?.trend.direction === "BULL" ? "Bullish" : "Bearish"} dengan High (${relHigh}), Low (${relLow}) Relevan`,
        status: stat1,
        timeframe: htfTfLabel,
      },
      {
        id: "msnr-snr",
        label: `② ${htfTfLabel} Malaysian SNR Zone (${snrType})`,
        status: stat2,
        timeframe: htfTfLabel
      },
      {
        id: "msnr-turtle",
        label: `③ ${htfTfLabel} Liquidity Sweep & Rejection (Turtle Soup)`,
        status: stat3,
        timeframe: htfTfLabel
      },
      {
        id: "msnr-mss-ob",
        label: `④ ${entryTfLabel} Market Structure Shift + OB/CISD (${sig.entry.toFixed(5)})`,
        status: stat4,
        timeframe: entryTfLabel
      },
      {
        id: "msnr-rr",
        label: `⑤ Minimum Risk-to-Reward 1:2 ${stat5 === "PASSED" ? "terpenuhi" : "belum terpenuhi"}`,
        status: stat5,
        details: `R:R 1:${rrRatio.toFixed(2)} | SL: ${sig.sl.toFixed(5)} | TP: ${sig.tp.toFixed(5)}`
      },
      {
        id: "msnr-entry",
        label: `⑥ ${entryTfLabel} entry retest level OB/CISD (pending order)`,
        status: stat4,
        timeframe: entryTfLabel,
        details: stat4 === "PASSED" ? `Pending ${sig.direction} Limit at ${sig.entry.toFixed(5)}` : "Menunggu konfirmasi harga."
      }
    ];

    return { items, passed };
  }
}

export const msnrStrategy = new MSNRStrategy();
