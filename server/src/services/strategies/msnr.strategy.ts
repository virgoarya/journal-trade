// ─── Malaysian Support & Resistance (MSNR) + ICT Hybrid Strategy ──────────────
// Custom Edge: SNR Level -> Liquidity Inducement Grab (Turtle Soup) -> MSS -> Entry on OB
// Flow:
// 1. Identify HTF SNR (Malaysian body-based)
// 2. Identify if recent HTF price tapped SNR AND swept a liquidity pool (Swing High/Low) with a wick rejection.
// 3. If HTF Turtle Soup is valid, scan LTF for a Market Structure Shift (MSS) reversing away from the SNR.
// 4. After MSS, find a valid LTF Order Block (OB).
// 5. Place PENDING_LIMIT entry at the OB.

import { type Candle, type MalaysianSNR, type OrderBlock, type SwingHigh, type SwingLow, type MarketStructure, type FractalContext } from "./market-structure.service";
import { atrService } from "./atr.service";
import { strategyConfigService } from "./strategy-config.service";
import type { ChecklistItem } from "./confluence-engine";

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
        
        signals.push(this.buildSignal(setup.direction, entryPrice, slPrice, "TURTLE_SOUP_OB", reason, msnrConfig, 15));
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

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  private buildSignal(direction: "BUY"|"SELL", limitPrice: number, slPrice: number, type: any, reason: string, config: any, confBoost = 0): MSNRSignal {
      const risk = Math.abs(limitPrice - slPrice);
      const tp = direction === "BUY" ? limitPrice + (risk * 2.5) : limitPrice - (risk * 2.5); // Minimum 1:2.5 RR

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

      sig.checklistItems = this.buildMSNRChecklist(sig);
      return sig;
  }

  private buildMSNRChecklist(sig: MSNRSignal): ChecklistItem[] {
    const isBuy = sig.direction === "BUY";
    const snrType = isBuy ? "Support (Body-based)" : "Resistance (Body-based)";

    return [
      {
        id: "msnr-snr-zone",
        label: `HTF Malaysian SNR ${snrType} terkonfirmasi`,
        status: "PASSED",
        timeframe: "H4"
      },
      {
        id: "msnr-turtle-soup",
        label: `Turtle Soup Wick Rejection di ${snrType}`,
        status: "PASSED",
        timeframe: "H1"
      },
      {
        id: "msnr-ltf-mss",
        label: `LTF Market Structure Shift (MSS) ${isBuy ? "Bullish" : "Bearish"} terdeteksi`,
        status: "PASSED",
        timeframe: "M15"
      },
      {
        id: "msnr-ob-limit",
        label: "Pending Order Limit di LTF Fresh Order Block",
        status: "PASSED",
        timeframe: "M15",
        value: `${sig.entry.toFixed(5)}`
      },
      {
        id: "msnr-rr",
        label: "Minimum Risk-to-Reward 1:2.5 Terpenuhi",
        status: "PASSED",
        details: `SL: ${sig.sl.toFixed(5)} | TP: ${sig.tp.toFixed(5)}`
      }
    ];
  }
}

export const msnrStrategy = new MSNRStrategy();
