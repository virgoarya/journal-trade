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
import { evaluateWaterfall, calculateRR, checkEntryRetest, getSwingPrices, analyzeDaily3CandleBias, validateContext, validateStructuralShift, validateInducement, validatePOI, validateEntryAndRisk } from "./checklist-validator";

export interface MSNRSignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  orderType: "MARKET" | "PENDING_LIMIT";
  limitPrice?: number;
  signalType: "TURTLE_SOUP_OB" | "TURTLE_SOUP_CISD" | "QML_BULLISH" | "QML_BEARISH" | "RBS" | "SBR";
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
    const htfAtr = atrService.calculate(htfCandles) || (Math.abs(htfCandles[htfCandles.length - 1].high - htfCandles[htfCandles.length - 1].low));

    // ─── STEP 1 & 2: MSNR Dealing Range & Inducement ──────────────
    // Alchemist storyline stays live through the trading day — a tap that
    // happened hours ago is still a live setup (not just the last 6 bars).
    const recentHtfCandles = htfCandles.slice(-12);
    const activeHtfSetups: { direction: "BUY" | "SELL", type: "QML_BULLISH" | "QML_BEARISH" | "RBS" | "SBR", keyLevel: number, sweepLevel: number }[] = [];

    // Tap check — MSNR ignores wick noise, but a touch is valid when price comes
    // WITHIN the level or pierces it and CLOSES back (rejection). The buffer
    // WIDENS the window (price may turn a few pips before the exact level due
    // to spread/liquidity) — it must never shrink it.
    const checkLevelTap = (c: Candle, level: number, dir: "BUY" | "SELL"): boolean => {
      const buf = htfAtr * 0.15;
      if (dir === "BUY") {
        return c.low <= level + buf && c.close > level - buf;
      }
      return c.high >= level - buf && c.close < level + buf;
    };
    const collectTapped = (setups: ReturnType<typeof this.detectMSNRSetups>, dir: "BUY" | "SELL") => {
      for (const setup of setups) {
        const { qmlLevel, rbsLevel } = setup;
        const lvlOpts = dir === "BUY"
          ? [{ type: "QML_BULLISH" as const, price: qmlLevel }, { type: "RBS" as const, price: rbsLevel }]
          : [{ type: "QML_BEARISH" as const, price: qmlLevel }, { type: "SBR" as const, price: rbsLevel }];
        for (const level of lvlOpts) {
          if (level.price === null || level.price === undefined) continue;
          const tapped = recentHtfCandles.some(c => checkLevelTap(c, level.price as number, dir));
          if (tapped) {
            activeHtfSetups.push({ direction: dir, type: level.type, keyLevel: level.price as number, sweepLevel: setup.inducement.price });
          }
        }
      }
    };

    collectTapped(this.detectMSNRSetups(htfStr, "BULL"), "BUY");
    collectTapped(this.detectMSNRSetups(htfStr, "BEAR"), "SELL");

    // ─── Jalur MalaysianSNR (body-based levels) — metode asli Alchemist ────
    // Level dibentuk dari transisi body close→open (bukan wick/swing), jauh
    // lebih sering muncul daripada pola QML 4-titik. Tap level + close-back =
    // Turtle Soup klasik.
    const snrs = htfStr.malaysianSNRs ?? [];
    const lastHtf = htfCandles[htfCandles.length - 1];
    for (const snr of snrs) {
      if (!snr.isFresh) continue; // level yang sudah dipakai = unfresh, lemah
      const isBuy = snr.type === "SUPPORT";
      const tapped = recentHtfCandles.some(c => checkLevelTap(c, snr.price, isBuy ? "BUY" : "SELL"));
      if (!tapped) continue;
      // Level harus masih "di depan" harga (support di bawah untuk BUY)
      if (isBuy && lastHtf.close < snr.price - htfAtr * 0.5) continue;
      if (!isBuy && lastHtf.close > snr.price + htfAtr * 0.5) continue;
      activeHtfSetups.push({
        direction: isBuy ? "BUY" : "SELL",
        type: isBuy ? "RBS" : "SBR",
        keyLevel: snr.price,
        sweepLevel: snr.price,
      });
    }

    // Deduplicate setups
    const uniqueSetups = activeHtfSetups.filter((v, i, a) => a.findIndex(t => (t.direction === v.direction && t.type === v.type && t.keyLevel === v.keyLevel)) === i);

    // ─── STEP 3 & 4: LTF MSS + OB ─────────────────────────────────────────────

    for (const setup of uniqueSetups) {
        const isBuy = setup.direction === "BUY";

        let mssFound = false;
        let mssIndex = -1;
        let mssPrice = 0;

        if (isBuy) {
            // Find the MOST RECENT LTF Swing High broken by a bullish candle body
            // (iterate newest first — the valid MSS is the break of the LATEST structure)
            const recentLtfHighs = ltfStr.swingHighs.slice(-8).reverse();
            for (const high of recentLtfHighs) {
                const breakoutCandles = ltfCandles.slice(high.index + 1);
                for (let i = 0; i < breakoutCandles.length; i++) {
                    const bc = breakoutCandles[i];
                    // MSS = body close beyond the swing + DISPLACEMENT (body >= 1.5×ATR).
                    // A weak close without displacement is not institutional.
                    if (bc.close > high.price && bc.close > bc.open &&
                        (bc.close - bc.open) >= msnrConfig.structureBreakMinBodyAtr * ltfAtr) { 
                        mssFound = true;
                        mssIndex = high.index + 1 + i; 
                        mssPrice = high.price;
                        break;
                    }
                }
                if (mssFound) break;
            }
        } else {
            // Find the MOST RECENT LTF Swing Low broken by a bearish candle body
            const recentLtfLows = ltfStr.swingLows.slice(-8).reverse();
            for (const low of recentLtfLows) {
                const breakoutCandles = ltfCandles.slice(low.index + 1);
                for (let i = 0; i < breakoutCandles.length; i++) {
                    const bc = breakoutCandles[i];
                    if (bc.close < low.price && bc.close < bc.open &&
                        (bc.open - bc.close) >= msnrConfig.structureBreakMinBodyAtr * ltfAtr) { 
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
            if (mssIndex - ob.index > 60) return false; // OB shouldn't be too old
            return true;
        });

        if (validOBs.length === 0) continue;

        const lastLtf = ltfCandles[ltfCandles.length - 1];

        // Choose the FIRST PRESENTED OB (closest to current price) — Alchemist
        // enters the first OB after the MSS, not the most discounted one far away
        // (a distant limit rarely fills and misses the delivery).
        const sortedOBs = [...validOBs].sort((a, b) => {
            const distA = isBuy ? lastLtf.close - a.top : a.bottom - lastLtf.close;
            const distB = isBuy ? lastLtf.close - b.top : b.bottom - lastLtf.close;
            return distA - distB;
        });
        const bestOB = sortedOBs[0];

        // Entry is a PENDING LIMIT — price may still be above the OB and pull
        // back to it. Accept deeper pullbacks (up to 6xATR) — the R:R check is
        // the real quality filter; a far OB in a strong trend simply gets
        // skipped when the order never fills.
        const entryPrice = (bestOB.top + bestOB.bottom) / 2;
        const entryGap = isBuy
          ? lastLtf.close - entryPrice
          : entryPrice - lastLtf.close;
        if (entryGap > ltfAtr * 6) continue;

        // ─── STEP 5: ENTRY (PENDING LIMIT at 50% of OB body = mean threshold) ──

        // Swing-protected SL: nearest swing low/high below/above OB, with a
        // minimum 0.5×ATR buffer so R:R stays sane and SL never == entry.
        let swingProtectedSl: number;
        if (isBuy) {
          const slCandidates = ltfStr.swingLows.filter(s => s.price < bestOB.bottom).sort((a, b) => b.price - a.price);
          const candidate = slCandidates.length > 0 ? slCandidates[0].price : bestOB.bottom;
          swingProtectedSl = Math.min(candidate, entryPrice - ltfAtr * 0.5);
        } else {
          const slCandidates = ltfStr.swingHighs.filter(s => s.price > bestOB.top).sort((a, b) => a.price - b.price);
          const candidate = slCandidates.length > 0 ? slCandidates[0].price : bestOB.top;
          swingProtectedSl = Math.max(candidate, entryPrice + ltfAtr * 0.5);
        }
        const slPrice = swingProtectedSl;

        // Ensure the setup isn't invalidated (price smashed SL of OB before we could enter)
        if (isBuy && lastLtf.close < slPrice) continue;
        if (!isBuy && lastLtf.close > slPrice) continue;

        const reason = `MSNR Hybrid ${setup.direction}: HTF Sweep (${setup.sweepLevel.toFixed(5)}) at ${setup.type} (${setup.keyLevel.toFixed(5)}) -> LTF MSS (${mssPrice.toFixed(5)}) -> OB Limit`;
        
        signals.push(this.buildSignal(setup.direction, entryPrice, slPrice, setup.type, reason, msnrConfig, fractal, 15));
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

    // ── Generate Checklist Items ───────────────────────────────────────────
    for (let i = validSignals.length - 1; i >= 0; i--) {
      const sig = validSignals[i];
      const validation = this.buildMSNRChecklist(sig, fractal);
      sig.checklistItems = validation.items;
      
      if (sig.confidence > 0 && !validation.passed) {
        validSignals.splice(i, 1);
      }
    }

    if (validSignals.length === 0) {
      const htfStr = fractal.directionStr || fractal.dailyStr;
      const dummyDir = htfStr.trend.direction === "BULL" ? "BUY" : "SELL";
      const dummySig: MSNRSignal = {
        direction: dummyDir,
        confidence: 0,
        entry: 0,
        sl: 0,
        tp: 0,
        orderType: "PENDING_LIMIT",
        signalType: "TURTLE_SOUP_OB",
        reason: "Scanning for setups...",
        checklistItems: []
      };
      const validation = this.buildMSNRChecklist(dummySig, fractal);
      dummySig.checklistItems = validation.items;
      validSignals.push(dummySig);
    }

    return validSignals.sort((a, b) => b.confidence - a.confidence);
  }

  private buildSignal(direction: "BUY"|"SELL", limitPrice: number, slPrice: number, type: any, reason: string, config: any, fractal: import("./market-structure.service").FractalContext, confBoost = 0): MSNRSignal {
      const h1Str = fractal.setupStr || fractal.directionStr;
      const htfStr = fractal.dailyStr;
      const tp = marketStructureService.findDynamicTarget(direction, limitPrice, slPrice, h1Str, 2.5, htfStr, fractal.daily); // Minimum 1:2.5 RR

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

  // Detect up to the last 3 structural patterns per direction (not just the
  // newest swing) — a QML/RBS storyline stays valid until it is tapped, so older
  // structures must keep producing setups while they remain untouched.
  private detectMSNRSetups(htfStr: MarketStructure, direction: "BULL" | "BEAR"): Array<{
    drHigh: import("./market-structure.service").SwingHigh | import("./market-structure.service").SwingLow;
    drLow: import("./market-structure.service").SwingLow | import("./market-structure.service").SwingHigh;
    inducement: import("./market-structure.service").SwingLow | import("./market-structure.service").SwingHigh;
    qmlLevel: number | null;
    rbsLevel: number | null;
    sbrLevel: number | null;
  }> {
    const { swingHighs, swingLows } = htfStr;
    const out: ReturnType<typeof this.detectMSNRSetups> = [];
    if (swingHighs.length < 3 || swingLows.length < 3) return out;

    const maxPatterns = 3;
    if (direction === "BULL") {
      for (let s = 0; s < maxPatterns && s < swingHighs.length - 1; s++) {
        const drHigh = swingHighs[swingHighs.length - 1 - s];

        // BOS_High: nearest previous swing high that is lower (the broken level)
        let bosHigh: import("./market-structure.service").SwingHigh | null = null;
        for (let i = swingHighs.length - 2 - s; i >= 0; i--) {
          if (swingHighs[i].price < drHigh.price) { bosHigh = swingHighs[i]; break; }
        }
        if (!bosHigh) continue;
        if (drHigh.index - bosHigh.index > 96) continue; // too old to be current storyline

        // DR_Low: lowest swing low between BOS_High and DR_High (the Head)
        const lowsBetween = swingLows.filter(sl => sl.index > bosHigh!.index && sl.index < drHigh.index);
        if (lowsBetween.length === 0) continue;
        const drLow = lowsBetween.sort((a, b) => a.price - b.price)[0];

        // Inducement: last pullback low before DR_High
        const pullbacks = swingLows.filter(sl => sl.index > drLow.index && sl.index < drHigh.index);
        if (pullbacks.length === 0) continue;
        const inducement = pullbacks[pullbacks.length - 1];

        // QML (Left Shoulder): swing low just BEFORE BOS_High. Valid only when
        // the Head makes a new low below the shoulder.
        const lowsBeforeBOS = swingLows.filter(sl => sl.index < bosHigh!.index);
        const leftShoulder = lowsBeforeBOS.length > 0 ? lowsBeforeBOS[lowsBeforeBOS.length - 1] : null;
        const qmlValid = leftShoulder != null && drLow.price < leftShoulder.price;

        out.push({
          drHigh, drLow, inducement,
          qmlLevel: qmlValid ? leftShoulder!.price : null,
          rbsLevel: bosHigh.price,
          sbrLevel: null,
        });
      }
    } else {
      for (let s = 0; s < maxPatterns && s < swingLows.length - 1; s++) {
        const drLow = swingLows[swingLows.length - 1 - s];

        let bosLow: import("./market-structure.service").SwingLow | null = null;
        for (let i = swingLows.length - 2 - s; i >= 0; i--) {
          if (swingLows[i].price > drLow.price) { bosLow = swingLows[i]; break; }
        }
        if (!bosLow) continue;
        if (drLow.index - bosLow.index > 96) continue;

        const highsBetween = swingHighs.filter(sh => sh.index > bosLow!.index && sh.index < drLow.index);
        if (highsBetween.length === 0) continue;
        const drHigh = highsBetween.sort((a, b) => b.price - a.price)[0];

        const pullbacks = swingHighs.filter(sh => sh.index > drHigh.index && sh.index < drLow.index);
        if (pullbacks.length === 0) continue;
        const inducement = pullbacks[pullbacks.length - 1];

        const highsBeforeBOS = swingHighs.filter(sh => sh.index < bosLow!.index);
        const leftShoulder = highsBeforeBOS.length > 0 ? highsBeforeBOS[highsBeforeBOS.length - 1] : null;
        const qmlValid = leftShoulder != null && drHigh.price > leftShoulder.price;

        out.push({
          drHigh, drLow, inducement,
          qmlLevel: qmlValid ? leftShoulder!.price : null,
          rbsLevel: null,
          sbrLevel: bosLow.price,
        });
      }
    }
    return out;
  }

  private buildMSNRChecklist(sig: MSNRSignal, fractal?: import("./market-structure.service").FractalContext): { items: ChecklistItem[], passed: boolean } {
    const isBuy = sig.direction === "BUY";
    const snrType = sig.signalType.includes("QML") ? "QML Level" : (sig.signalType === "RBS" ? "RBS Level" : (sig.signalType === "SBR" ? "SBR Level" : "Key S/R Zone"));

    const { rrRatio, isRRValid } = calculateRR(sig.entry, sig.sl, sig.tp);
    const setupTfLabel = fractal?.setupTimeframeStr || "H1";
    const htfTfLabel = fractal?.directionTimeframeStr || "H4";
    const entryTfLabel = fractal?.entryTimeframeStr || "M15";
    const dailyBias = analyzeDaily3CandleBias(fractal?.daily || fractal?.direction);

    const lastCandle = fractal?.entry && fractal.entry.length > 0 ? fractal.entry[fractal.entry.length - 1] : null;
    const currentPrice = lastCandle ? lastCandle.close : 0;
    const isEntryRetested = checkEntryRetest(currentPrice, sig.entry, isBuy);

    const isDailyAligned = isBuy ? dailyBias.direction === "BULL" : dailyBias.direction === "BEAR";
    
    // Prepare inputs for new validation helpers
    const htfStr = fractal?.directionStr || fractal?.dailyStr;
    const htfTrend = htfStr?.trend?.direction || "SIDEWAYS";
    const breachType = sig.signalType.includes("QML") ? "MSS" : (sig.signalType.includes("RBS") || sig.signalType.includes("SBR") ? "CHOCH" : "MSS");
    // MSNR always enters on an OB/CISD — surface the ACTUAL entry OB zone
    // (previously hardcoded "N/A - N/A" made the POI step meaningless).
    const entryObs = (fractal?.entryStr?.orderBlocks ?? []).filter(ob => ob.type === (isBuy ? "BULLISH" : "BEARISH"));
    const entryOb = entryObs.find(ob => sig.entry >= ob.bottom && sig.entry <= ob.top) ?? entryObs[0];
    const hasOB = entryObs.length > 0; // MSNR always has OB/CISD entry
    const hasFVG = false;
    const obSweepPrice = sig.entry.toFixed(5);
    const { relHigh, relLow } = getSwingPrices(fractal);

    // Validate key components using new helpers
    const ctxValidation = validateContext(isBuy, htfTrend, dailyBias);
    // MSNR trades reversals — ranging HTF is a valid context, NOT a signal killer.
    // Make the BOS step non-failable (it becomes WAITING instead of FAILED when
    // the H4 trend is sideways, so range/SBR-RBS trades are not discarded).
    const bosValidation = { ...validateStructuralShift(isBuy, htfStr!, htfTfLabel, relHigh, relLow), isFailable: false };
    const liquidityValidation = validateInducement(true, obSweepPrice, relLow, setupTfLabel, isBuy); // Turtle Soup always implies sweep
    const poiValidation = validatePOI(breachType, hasOB, hasFVG, entryOb ? entryOb.bottom.toFixed(5) : "N/A", entryOb ? entryOb.top.toFixed(5) : "N/A", isBuy ? "BULLISH" : "BEARISH", relLow, relHigh, setupTfLabel, htfTfLabel);
    const entryRiskValidation = validateEntryAndRisk(isBuy, isEntryRetested, sig.entry, sig.sl, sig.tp, entryTfLabel);

    // Get new structural elements for MSNR checklist
    const setupStr = fractal?.setupStr;
    const directionStr = fractal?.directionStr;
    
    // Determine appropriate structure to extract QML, SNR Flip, IFVG, CISD from
    const marketStr = setupStr || directionStr || ({} as import("./market-structure.service").MarketStructure);
    const qml = marketStr.quasimodos?.find(q => q.type === (isBuy ? "BULLISH" : "BEARISH"));
    const snrFlip = marketStr.snrFlips?.find(f => (isBuy ? f.type === "RBS" : f.type === "SBR"));
    const ifvg = marketStr.ifvgs?.find(i => i.type === (isBuy ? "BULLISH" : "BEARISH"));
    const cisd = marketStr.cisds?.find(c => c.type === (isBuy ? "BULLISH" : "BEARISH"));

    return evaluateWaterfall([
      { ...ctxValidation, label: (status, isPassed) => ctxValidation.label },
      { ...bosValidation, label: (status, isPassed) => bosValidation.label },
      { ...liquidityValidation, label: (status, isPassed) => liquidityValidation.label },
      { ...poiValidation, label: (status, isPassed) => poiValidation.label },
      {
        id: "msnr-qml",
        label: (status, isPassed) => qml ? `QML ${qml.type} at ${qml.shoulder.toFixed(5)}-${qml.head.toFixed(5)}` : `QML not detected`,
        timeframe: htfTfLabel,
        condition: !!qml,
        details: (status) => qml ? `QML level ${qml.shoulder.toFixed(5)} (shoulder) -> ${qml.head.toFixed(5)} (head)` : "",
        isIndependent: true,
      },
      {
        id: "msnr-snr-flip",
        label: (status, isPassed) => snrFlip ? `SNR-Flip ${snrFlip.type} detected at ${snrFlip.level.toFixed(5)}` : `SNR-Flip not detected`,
        timeframe: htfTfLabel,
        condition: !!snrFlip,
        details: (status) => snrFlip ? `Flip at ${snrFlip.level.toFixed(5)}` : "",
        isIndependent: true,
      },
      {
        id: "msnr-ifvg",
        label: (status, isPassed) => ifvg ? `IFVG ${ifvg.type} detected at ${ifvg.top.toFixed(5)}-${ifvg.bottom.toFixed(5)}` : `IFVG not detected`,
        timeframe: htfTfLabel,
        condition: !!ifvg,
        details: (status) => ifvg ? `IFVG range ${ifvg.top.toFixed(5)} - ${ifvg.bottom.toFixed(5)}` : "",
        isIndependent: true,
      },
      {
        id: "msnr-cisd",
        label: (status, isPassed) => cisd ? `CISD ${cisd.type} at ${cisd.price.toFixed(5)}` : `CISD not detected`,
        timeframe: htfTfLabel,
        condition: !!cisd,
        details: (status) => cisd ? `CISD price ${cisd.price.toFixed(5)}` : "",
        isIndependent: true,
      },
      {
        id: "msnr-entry",
        label: (status, isPassed) => `④ ${entryTfLabel} Entry retest OB/CISD (pending order ${sig.direction} Limit)`,
        timeframe: entryTfLabel,
        condition: entryRiskValidation.entryOk,
        details: (status) => status === "PASSED" ? `Pending ${sig.direction} Limit at ${sig.entry.toFixed(5)}` : "Menunggu konfirmasi harga.",
      },
      {
        id: "msnr-rr",
        label: (status, isPassed) => `⑤ Minimum Risk-to-Reward 1:2 ${status === "PASSED" ? "terpenuhi" : "belum terpenuhi"}`,
        condition: entryRiskValidation.rrOk,
        isFailable: true,
        details: (status) => status === "PASSED" ? `R:R 1:${entryRiskValidation.rrRatio.toFixed(2)} | SL: ${sig.sl.toFixed(5)} | TP: ${sig.tp.toFixed(5)}` : `Menunggu titik entry tervalidasi`,
      },
    ]);
  }
}

export const msnrStrategy = new MSNRStrategy();
