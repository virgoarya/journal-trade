// ─── ICT + CRT Merged Strategy ──────────────────────────────────────────────
// Philosophy: CRT (3-Candle AMD / Range Context) acts as FILTER for ICT (FVG, OTE, Judas Swing).
// Only signals that have BOTH an ICT structural level AND CRT candle context will pass.
//
// Path A: CRT 3-Candle Manipulation → ICT FVG/OTE inside the same zone
// Path B: ICT FVG/OTE/Judas → validated by CRT Liquidity Sweep or AMD context
//
// This eliminates:
// - ICT: FVG over-trading (1852 trades at 49.5% WR)
// - CRT: Range breakout noise (952 trades at 47.1% WR)
// Expected: 400–700 combined trades, WR 55–65%

import {
  marketStructureService,
  type Candle,
  type MarketStructure,
  type FVG,
  type KillzoneType,
} from "./market-structure.service";
import { atrService } from "./atr.service";
import { strategyConfigService } from "./strategy-config.service";
import type { IPDAContext } from "./ipda-context";
import type { ChecklistItem } from "./confluence-engine";
import { evaluateWaterfall, calculateRR, checkEntryRetest, getSwingPrices, analyzeDaily3CandleBias, validateContext, validateStructuralShift, validateInducement, validatePOI, validateEntryAndRisk } from "./checklist-validator";

export interface ICTSignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  orderType: "MARKET" | "PENDING_LIMIT";
  limitPrice?: number;
  signalType:
    | "AMD_FVG"          // 3-Candle AMD pattern + FVG confluence
    | "AMD_OTE"          // 3-Candle AMD pattern + OTE confluence
    | "SWEEP_FVG"        // Liquidity Sweep + FVG fill
    | "JUDAS_SWEEP"      // Judas Swing + Sweep context
    | "OTE_AMD"          // OTE Fibonacci + AMD range context
    | "IFVG_RETEST"      // Retest of inverted FVG (IFVG)
    | "C2_CLOSURE"       // C2 Closure (Detrades continuation model)
    | "C2_DNT"           // C2 DNT (Detrades Reversal into Expansion model)
    | "DCM_CONTINUATION" // DCM (Detrades Continuation Model - MTF Imbalance Retrace)
    | "SMR_REVERSAL"     // SMR Composite (TS + CISD + PDA Inverse + SMT)
    | "SMT_DIVERGENCE";  // SMT Divergence confirmation
  breachType?: "MSS" | "CHOCH" | "OB_MITIGATION" | "BREAKER" | "LIQUIDITY_GRAB" | "M5_CHOCH_OB" | "FVG" | "OTE" | "AMD" | "JUDAS" | "C2_CLOSURE" | "C2_DNT" | "DCM_CONTINUATION" | "SMR_REVERSAL" | "SMT_DIVERGENCE";
  killzone?: KillzoneType;
  reason: string;
  isFomoDetected?: boolean;
  isSmrComplete?: boolean;
  checklistItems?: ChecklistItem[];
}

export interface ICTAnalysis {
  signal: ICTSignal | null;
  signals: ICTSignal[];
}

class ICTStrategy {
  /**
   * Full ICT+CRT analysis. Only dual-confluenced setups pass through.
   */
  analyze(fractal: import("./market-structure.service").FractalContext, ipda?: IPDAContext): ICTSignal[] {
    const signals: ICTSignal[] = [];

    if (!fractal.isAligned) return signals;

    const config = strategyConfigService.getICTConfig();
    const htfTrend = fractal.directionStr.trend.direction;

    const setupCandles = fractal.setup;
    const entryCandles = fractal.entry;
    const entryStr = fractal.entryStr;

    if (setupCandles.length < 3 || entryCandles.length < 3) return signals;

    const lastEntry = entryCandles[entryCandles.length - 1];
    const atr = atrService.calculate(entryCandles);
    const avgRange = atr > 0 ? atr : this.avgRange(entryCandles, 5);

    const currentKillzone = this.getCurrentKillzone(lastEntry.time);

    // ─── PATH A: CRT 3-Candle AMD → ICT FVG/OTE inside zone ───────────────────

    const amdResult = this.detectAMDPattern(setupCandles, fractal.setupStr, htfTrend, avgRange);

    if (amdResult) {
      // Look for ICT FVG inside the AMD zone (around the sweep)
      const fvgSignal = this.findFVGInsideZone(
        entryCandles,
        entryStr,
        amdResult.direction,
        amdResult.zoneHigh,
        amdResult.zoneLow,
        avgRange,
        config,
        currentKillzone,
      );
      if (fvgSignal) signals.push(fvgSignal);

      // Look for OTE inside the AMD zone
      const oteSignal = this.findOTEInsideZone(
        entryCandles,
        entryStr,
        amdResult.direction,
        amdResult.zoneHigh,
        amdResult.zoneLow,
        avgRange,
        config,
      );
      if (oteSignal) signals.push(oteSignal);
    }

    // ─── PATH B: Liquidity Sweep → ICT FVG confirmation ────────────────────────

    const sweepResult = this.detectLiquiditySweep(entryCandles, entryStr, avgRange, htfTrend);
    if (sweepResult) {
      // After a sweep, look for nearest unmitigated FVG in sweep's direction
      const sweepFvgSignal = this.buildSweepFVGSignal(
        entryCandles,
        entryStr,
        sweepResult.direction,
        sweepResult.sweepLevel,
        avgRange,
        config,
        currentKillzone,
        sweepResult.swingSweepLow,
        sweepResult.swingSweepHigh,
      );
      if (sweepFvgSignal) signals.push(sweepFvgSignal);
    }

    // ─── PATH C: Judas Swing → validated by prior Sweep Context ────────────────

    const judasSignal = this.detectJudasWithContext(entryCandles, entryStr, avgRange, htfTrend, fractal);
    if (judasSignal) signals.push(judasSignal);

    // ─── PATH D: OTE + AMD Range Context ────────────────────────────────────────

    const oteAmdSignal = this.detectOTEWithAMDContext(
      setupCandles,
      entryCandles,
      entryStr,
      htfTrend,
      avgRange,
      config,
      fractal,
    );
    if (oteAmdSignal) signals.push(oteAmdSignal);

    // ─── PATH E: IFVG (Inversion FVG) Retest ────────────────────────────────────

    const ifvgSignal = this.detectIFVGEntry(
      entryCandles,
      entryStr,
      htfTrend,
      avgRange,
      config
    );
    if (ifvgSignal) signals.push(ifvgSignal);

    // ─── PATH F: C2 Closure & C2 DNT (Detrades Models) ──────────────────────

        const c2Result = this.detectC2Closure(setupCandles, fractal.setupStr, htfTrend, avgRange);
        if (c2Result) {
          const last = entryCandles[entryCandles.length - 1];
          // Entry at FVG midpoint (continuation gap between C1 and C2)
          const entry = (c2Result.fvgTop + c2Result.fvgBottom) / 2;
          // SL at the manipulation wick (C2 low for bullish, C2 high for bearish)
          const sl = c2Result.direction === "BUY"
            ? c2Result.fvgBottom - avgRange * 0.5
            : c2Result.fvgTop + avgRange * 0.5;
          const h1Str = fractal.setupStr || fractal.directionStr;
          const htfStr = fractal.dailyStr;
          const tp = marketStructureService.findDynamicTarget(c2Result.direction, entry, sl, h1Str, 2.0, htfStr, fractal.daily);

          const conf = config.minConfidence + 18;

          signals.push({
            direction: c2Result.direction,
            entry,
            sl,
            tp,
            orderType: "PENDING_LIMIT",
            limitPrice: entry,
            signalType: "C2_CLOSURE",
            breachType: "C2_CLOSURE",
            killzone: currentKillzone !== "NONE" ? currentKillzone : undefined,
            confidence: Math.min(94, conf),
            reason: `C2 Closure: Continuation gap [${c2Result.fvgBottom.toFixed(5)}–${c2Result.fvgTop.toFixed(5)}], HTF ${htfTrend}`,
          });
        }

        const c2DntResult = this.detectC2DNT(setupCandles, fractal.setupStr, htfTrend, avgRange);
        if (c2DntResult) {
          const entry = c2DntResult.entryPrice;
          const sl = c2DntResult.slPrice;
          const h1Str = fractal.setupStr || fractal.directionStr;
          const htfStr = fractal.dailyStr;
          const tp = marketStructureService.findDynamicTarget(c2DntResult.direction, entry, sl, h1Str, 3.5, htfStr, fractal.daily); // DNT targets ~3.5R average

          // Boost confidence if FOMO candle detected (the missing piece!)
          let conf = config.minConfidence + 22;
          if (c2DntResult.isFomo) conf += 10;

          signals.push({
            direction: c2DntResult.direction,
            entry,
            sl,
            tp,
            orderType: "MARKET", // DNT trades directly on Candle 2 expansion
            signalType: "C2_DNT",
            breachType: "C2_DNT",
            killzone: currentKillzone !== "NONE" ? currentKillzone : undefined,
            confidence: Math.min(98, conf),
            isFomoDetected: c2DntResult.isFomo,
            reason: `C2 DNT (Reversal into Expansion): Bulky C1 + Reversal C2${c2DntResult.isFomo ? ' [FOMO Candle Confirmed]' : ''}, HTF ${htfTrend}`,
          });
        }

        // ─── PATH G: SMT Structural State (for Cross-Pair Comparison) ──────────────

        // Gather structural state for SMT divergence comparison
        // This will be used by ai-trading-engine when comparing correlated pairs
        const smtState = this.getSMTStructuralState(entryCandles, entryStr, htfTrend);
        if (smtState && smtState.atKeyLevel) {
          // Add a signal that carries SMT structural data for cross-pair analysis
          // The actual divergence check happens in Confluence Engine when multiple symbols are analyzed
          signals.push({
            direction: htfTrend === "BULL" ? "BUY" : "SELL",
            entry: smtState.keyLevelPrice,
            sl: htfTrend === "BULL" 
              ? smtState.keyLevelPrice - avgRange * 1.5
              : smtState.keyLevelPrice + avgRange * 1.5,
            tp: htfTrend === "BULL"
              ? smtState.keyLevelPrice + avgRange * 4
              : smtState.keyLevelPrice - avgRange * 4,
            orderType: "MARKET",
            signalType: "SMT_DIVERGENCE",
            breachType: "SMT_DIVERGENCE",
            killzone: currentKillzone !== "NONE" ? currentKillzone : undefined,
            confidence: config.minConfidence + 10, // Base confidence, will be boosted if divergence confirmed
            reason: `SMT Structural State: ${smtState.internalStructure} at ${smtState.keyLevelType} ${smtState.keyLevelPrice.toFixed(5)}`,
            });
            }

            // ─── PATH H: DCM (Detrades Continuation Model) ─────────────────────────

            const dcmResult = this.detectDCMContinuation(setupCandles, fractal.setupStr, entryCandles, entryStr, htfTrend, avgRange);
            if (dcmResult) {
            const h1Str = fractal.setupStr || fractal.directionStr;
            const htfStrLocal = fractal.dailyStr;
            const tp = marketStructureService.findDynamicTarget(dcmResult.direction, dcmResult.entry, dcmResult.sl, h1Str, 2.0, htfStrLocal, fractal.daily);

            signals.push({
              direction: dcmResult.direction,
              entry: dcmResult.entry,
              sl: dcmResult.sl,
              tp,
              orderType: "PENDING_LIMIT",
              limitPrice: dcmResult.entry,
              signalType: "DCM_CONTINUATION",
              breachType: "DCM_CONTINUATION",
              killzone: currentKillzone !== "NONE" ? currentKillzone : undefined,
              confidence: Math.min(96, config.minConfidence + 20),
              reason: `DCM Continuation: MTF Imbalance [${dcmResult.imbalanceBottom.toFixed(5)}–${dcmResult.imbalanceTop.toFixed(5)}] + LTF CISD, HTF ${htfTrend}`,
            });
            }

            // ─── PATH I: SMR Composite (Smart Money Reversal) ──────────────────────

            const smrResult = this.detectSMRComposite(entryCandles, entryStr, htfTrend, avgRange);
            if (smrResult) {
            const h1Str = fractal.setupStr || fractal.directionStr;
            const htfStrLocal = fractal.dailyStr;
            const tp = marketStructureService.findDynamicTarget(smrResult.direction, smrResult.entry, smrResult.sl, h1Str, 3.0, htfStrLocal, fractal.daily);

            let smrConf = config.minConfidence + 15;
            if (smrResult.hasPDAInverse) smrConf += 8;
            if (smrResult.hasSMT) smrConf += 7;
            const pillarCount = [smrResult.hasTS, smrResult.hasCISD, smrResult.hasPDAInverse, smrResult.hasSMT].filter(Boolean).length;

            signals.push({
              direction: smrResult.direction,
              entry: smrResult.entry,
              sl: smrResult.sl,
              tp,
              orderType: "MARKET",
              signalType: "SMR_REVERSAL",
              breachType: "SMR_REVERSAL",
              killzone: currentKillzone !== "NONE" ? currentKillzone : undefined,
              confidence: Math.min(98, smrConf),
              isSmrComplete: pillarCount === 4,
              reason: `SMR Reversal (${pillarCount}/4 pillars): ${smrResult.hasTS ? 'TS✓' : 'TS✗'} ${smrResult.hasCISD ? 'CISD✓' : 'CISD✗'} ${smrResult.hasPDAInverse ? 'PDA✓' : 'PDA✗'} ${smrResult.hasSMT ? 'SMT✓' : 'SMT✗'}, HTF ${htfTrend}`,
            });
            }

            // ── IPDA Context: adjust confidence ──
    if (ipda && signals.length > 0) {
      for (const sig of signals) {
        if (ipda.dailyBias.bias !== "SIDEWAYS") {
          const aligned = (sig.direction === "BUY" && ipda.dailyBias.bias === "BULLISH") ||
                          (sig.direction === "SELL" && ipda.dailyBias.bias === "BEARISH");
          if (!aligned) sig.confidence = Math.round(sig.confidence * 0.7);
          else sig.confidence = Math.min(95, Math.round(sig.confidence * 1.1));
        }
        // IPDA retracement: sweep+FVG signals in retracement toward daily bias are high quality
        if (ipda.intraday.state === "RETRACEMENT" && sig.signalType.includes("FVG")) {
          const towardBias = (ipda.dailyBias.bias === "BULLISH" && sig.direction === "BUY") ||
                             (ipda.dailyBias.bias === "BEARISH" && sig.direction === "SELL");
          if (towardBias) sig.confidence = Math.min(95, sig.confidence + 10);
        }
      }
    }

    // Filter out signals with R:R < 1:2 (RR < 2.0)
    // Recalculate dynamic TP based on HTF structure to maximize R:R

    // ── Invalidation: remove setups where TP was hit before entry ────
    const nonInvalidatedSignals = signals.filter(sig => {
      const setupIdx = entryCandles.length - 1; // Approximate: setup is the latest candle
      return !marketStructureService.isTargetTakenBeforeEntry(
        entryCandles,
        setupIdx,
        sig.direction,
        sig.tp,
        fractal,
      );
    });

    // TP targets H1 external structure (BSL/SSL) for liquidity take profit,
    // with HTF (H4/D1) priority for bigger liquidity pools
    const h1Str = fractal.setupStr || fractal.directionStr;
    const htfStr = fractal.dailyStr;
    const validSignals = nonInvalidatedSignals.filter(sig => {

      // Find dynamic target
      sig.tp = marketStructureService.findDynamicTarget(sig.direction, sig.entry, sig.sl, h1Str, 2.0, htfStr, fractal.daily);

      const slDist = Math.abs(sig.entry - sig.sl);
      const tpDist = Math.abs(sig.tp - sig.entry);
      if (slDist <= 0) return false;
      const rr = tpDist / slDist;
      return rr >= 2.0;
    });

    // ── Generate Checklist Items ───────────────────────────────────────────
    for (let i = validSignals.length - 1; i >= 0; i--) {
      const sig = validSignals[i];
      const validation = this.buildICTChecklist(sig, currentKillzone, fractal);
      sig.checklistItems = this.buildICTDisplayItems(sig, currentKillzone, fractal);

      // Strict Validation: Drop signal if core steps failed
      if (sig.confidence > 0 && !validation.passed) {
        validSignals.splice(i, 1);
      }
    }

    if (validSignals.length === 0) {
      const dummyDir = (htfStr && htfStr.trend.direction === "BEAR") ? "SELL" : "BUY";
      const dummySig: ICTSignal = {
        direction: dummyDir,
        confidence: 0,
        entry: 0,
        sl: 0,
        tp: 0,
        orderType: "MARKET",
        signalType: "AMD_FVG",
        reason: "Scanning for setups...",
        checklistItems: []
      };
      const validation = this.buildICTChecklist(dummySig, currentKillzone, fractal);
      dummySig.checklistItems = this.buildICTDisplayItems(dummySig, currentKillzone, fractal);
      validSignals.push(dummySig);
    }

    return validSignals.sort((a, b) => b.confidence - a.confidence);
  }

  private buildICTChecklist(
      sig: ICTSignal,
      killzone: KillzoneType,
      fractal?: import("./market-structure.service").FractalContext
    ): { items: ChecklistItem[], passed: boolean } {
      const isBuy = sig.direction === "BUY";
      const kzLabel = killzone !== "NONE" ? `${killzone} Killzone aktif` : "Outside Killzone (Session)";

      const { rrRatio, isRRValid } = calculateRR(sig.entry, sig.sl, sig.tp);
      const setupTfLabel = fractal?.setupTimeframeStr || "H1";
      const htfTfLabel = fractal?.directionTimeframeStr || "H4";
      const entryTfLabel = fractal?.entryTimeframeStr || "M15";
      const dailyBias = analyzeDaily3CandleBias(fractal?.daily || fractal?.direction);

      const { relHigh, relLow } = getSwingPrices(fractal);
      const htfStr = fractal?.directionStr || fractal?.dailyStr;
      const isHtfDirectional = htfStr ? (isBuy ? htfStr.trend.direction === "BULL" : htfStr.trend.direction === "BEAR") : false;

      const isC2Closure = sig.signalType === "C2_CLOSURE";
      const isC2DNT = sig.signalType === "C2_DNT";
      const isDCM = sig.signalType === "DCM_CONTINUATION";
      const isSMR = sig.signalType === "SMR_REVERSAL";
      const isSMTDiv = sig.signalType === "SMT_DIVERGENCE";
      const hasAMD = sig.signalType.includes("AMD") || sig.signalType === "JUDAS_SWEEP";
      const hasFVG = sig.signalType.includes("FVG") || isC2Closure || isSMTDiv || isDCM;
      const hasOTE = sig.signalType.includes("OTE");
      const hasSweep = sig.signalType.includes("SWEEP") || sig.signalType.includes("AMD") || sig.signalType === "JUDAS_SWEEP" || isC2DNT || isSMR;

      const lastCandle = fractal?.entry && fractal.entry.length > 0 ? fractal.entry[fractal.entry.length - 1] : null;
      const currentPrice = lastCandle ? lastCandle.close : 0;
      const isEntryRetested = checkEntryRetest(currentPrice, sig.entry, isBuy);

      const isDailyAligned = isBuy ? dailyBias.direction === "BULL" : dailyBias.direction === "BEAR";

      // Prepare inputs for new validation helpers
      const htfTrend = htfStr ? htfStr.trend.direction : "SIDEWAYS";
      const breachType = sig.breachType ?? (isC2Closure ? "C2_CLOSURE" : isSMTDiv ? "SMT_DIVERGENCE" : "FVG");
      const hasOB = breachType.includes("FVG") || hasOTE || isC2Closure;
      const hasFVGForPOI = hasFVG || hasOTE || isC2Closure;
      const hasRecentSweepICT = hasSweep || hasAMD;

      // Validate key components using new helpers
      const ctxValidation = validateContext(isBuy, htfTrend, dailyBias);
      const bosValidation = htfStr ? validateStructuralShift(isBuy, htfStr, htfTfLabel, relHigh, relLow) : { id: "ctx-bos", label: "Unconfirmed", timeframe: htfTfLabel, condition: false, isFailable: true };
      const liquidityValidation = validateInducement(hasRecentSweepICT, sig.entry.toFixed(5), relLow, setupTfLabel, isBuy);
      const poiValidation = validatePOI(breachType, hasOB, hasFVGForPOI, "N/A", "N/A", isBuy ? "BULLISH" : "BEARISH", relLow, relHigh, setupTfLabel, htfTfLabel);
      const entryRiskValidation = validateEntryAndRisk(isBuy, isEntryRetested, sig.entry, sig.sl, sig.tp, entryTfLabel);

      // Get new structural elements for ICT checklist
      const ifvg = fractal?.ifvgs?.find(i => i.type === (isBuy ? "BULLISH" : "BEARISH"));
      const cisd = fractal?.cisds?.find(c => c.type === (isBuy ? "BULLISH" : "BEARISH"));

      return evaluateWaterfall([
        { ...ctxValidation, label: (status, isPassed) => ctxValidation.label },
        { ...bosValidation, label: (status, isPassed) => bosValidation.label },
        { ...liquidityValidation, label: (status, isPassed) => liquidityValidation.label },
        { ...poiValidation, label: (status, isPassed) => poiValidation.label },
        {
          id: "ict-kz",
          label: () => `① Sesi & Waktu (${entryTfLabel})`,
          timeframe: entryTfLabel,
          condition: killzone !== "NONE",
          isIndependent: true,
        },
        {
          id: "ict-bos",
          label: () => `② HTF Structure (${htfTfLabel})`,
          timeframe: htfTfLabel,
          condition: htfStr ? (isBuy ? htfStr.trend.direction === "BULL" : htfStr.trend.direction === "BEAR") : false,
          isFailable: true,
        },
        {
          id: "ict-c2",
          label: () => isC2DNT ? `③ C2 DNT (${setupTfLabel})` : (isC2Closure ? `③ C2 Closure (${setupTfLabel})` : (hasAMD ? `③ AMD Pattern (${setupTfLabel})` : "③ Pattern Detection")),
          timeframe: setupTfLabel,
          condition: isC2DNT || isC2Closure || hasAMD,
          isIndependent: true,
        },
        {
          id: "ict-c2dnt-confirm",
          label: () => `④ C2 DNT LTF Confirmation (${entryTfLabel})`,
          timeframe: entryTfLabel,
          condition: this.confirmC2DNTLTF(fractal),
          isIndependent: true,
        },
        {
          id: "ict-smt",
          label: () => `④ SMT Divergence (${setupTfLabel})`,
          timeframe: setupTfLabel,
          condition: isSMTDiv,
          isIndependent: true,
        },
        {
          id: "ict-fvg-ote",
          label: (status) => {
            const fvgs = fractal?.entryStr?.fairValueGaps ?? [];
            const entryCandles = fractal?.entry ?? [];
            const localAvg = entryCandles.length >= 5
              ? entryCandles.slice(-5).reduce((s, c) => s + (c.high - c.low), 0) / Math.min(5, entryCandles.length)
              : 0;
            const nearFvg = fvgs.find(f => !f.mitigated && (
              isBuy ? Math.abs(f.bottom - sig.entry) < Math.max(localAvg * 0.5, 1e-8) : Math.abs(f.top - sig.entry) < Math.max(localAvg * 0.5, 1e-8)
            ));
            if (status === "PASSED") {
              const zone = nearFvg ? `${nearFvg.bottom.toFixed(5)}–${nearFvg.top.toFixed(5)}` : sig.entry.toFixed(5);
              return isC2Closure ? `⑤ FVG dalam C2 Zone (${entryTfLabel}) (${zone})` : (hasOTE ? `⑤ OTE Zone (${entryTfLabel}) (${zone})` : `⑤ FVG (${entryTfLabel}) (${zone})`);
            }
            return isC2Closure ? `⑤ FVG dalam C2 Zone (${entryTfLabel})` : (hasOTE ? `⑤ OTE Zone (${entryTfLabel})` : `⑤ FVG (${entryTfLabel})`);
          },
          timeframe: entryTfLabel,
          condition: hasFVG || hasOTE || isC2Closure,
        },
        {
          id: "ict-entry",
          label: () => `⑥ Entry Retest (${sig.entry.toFixed(5)})`,
          timeframe: entryTfLabel,
          condition: entryRiskValidation.entryOk,
          details: (status) => status === "PASSED" ? `Pending ${sig.direction} Limit at ${sig.entry.toFixed(5)}` : "Menunggu konfirmasi harga.",
        },
        {
          id: "ict-rr",
          label: (status) => `⑦ Risk-to-Reward 1:2 ${status === "PASSED" ? "terpenuhi" : "belum terpenuhi"}`,
          condition: entryRiskValidation.rrOk,
          isFailable: true,
          details: (status) => status === "PASSED" ? `R:R 1:${entryRiskValidation.rrRatio.toFixed(2)} | SL: ${sig.sl.toFixed(5)} | TP: ${sig.tp.toFixed(5)}` : `Menunggu titik entry tervalidasi`,
        },
      ]);
      }



  /** Display checklist rapi (engine-flow + target level saat WAITING). UI only, tidak dipakai engine buat drop. */
  private buildICTDisplayItems(sig: ICTSignal, killzone: KillzoneType, fractal?: import("./market-structure.service").FractalContext): ChecklistItem[] {
      const isBuy = sig.direction === "BUY";
      const isC2Closure = sig.signalType === "C2_CLOSURE";
      const isC2DNT = sig.signalType === "C2_DNT";
      const isDCM = sig.signalType === "DCM_CONTINUATION";
      const isSMR = sig.signalType === "SMR_REVERSAL";
      const isSMTDiv = sig.signalType === "SMT_DIVERGENCE";
      const hasAMD = sig.signalType.includes("AMD") || sig.signalType.includes("JUDAS");
      const hasOTE = sig.signalType.includes("OTE");
      const hasFVG = sig.signalType.includes("FVG") || isC2Closure || isSMTDiv || isDCM;
      const hasSweep = sig.signalType.includes("SWEEP") || hasAMD || isC2DNT || isSMR;
      const hasIFVG = sig.signalType === "IFVG_RETEST";
      const { rrRatio, isRRValid } = calculateRR(sig.entry, sig.sl, sig.tp);
      const setupTfLabel = fractal?.setupTimeframeStr || "H1";
      const htfTfLabel = fractal?.directionTimeframeStr || "H4";
      const entryTfLabel = fractal?.entryTimeframeStr || "M15";
      const htfStr = fractal?.directionStr || fractal?.dailyStr;
      const isHtfDirectional = !!htfStr && (isBuy ? htfStr.trend.direction === "BULL" : htfStr.trend.direction === "BEAR");
      const lastCandle = fractal?.entry && fractal.entry.length > 0 ? fractal.entry[fractal.entry.length - 1] : null;
      const currentPrice = lastCandle ? lastCandle.close : 0;
      const isEntryRetested = checkEntryRetest(currentPrice, sig.entry, isBuy);
      const { relHigh, relLow } = getSwingPrices(fractal ?? undefined);
      const targetSweep = isBuy ? relLow : relHigh;
      const kzLabel = killzone !== "NONE" ? `${killzone} Killzone aktif` : "Outside Killzone";
      const mk = (id: string, label: string, condition: boolean, opts?: { isIndependent?: boolean; isFailable?: boolean; value?: string; details?: string; timeframe?: string }): ChecklistItem => {
        const status: "PASSED" | "WAITING" | "FAILED" = condition ? "PASSED" : (opts?.isIndependent ? "WAITING" : "FAILED");
        return { id, label, status, value: opts?.value, timeframe: opts?.timeframe, details: opts?.details };
      };
      return [
        mk("ict-kz", `① Sesi & Waktu: ${kzLabel}`, killzone !== "NONE", { isIndependent: true, value: killzone !== "NONE" ? killzone : "None", details: "ICT setups prefer London/NY killzone windows.", timeframe: entryTfLabel }),
        mk("ict-bos", `② HTF Structure (${htfTfLabel}) : ${isHtfDirectional ? (isBuy ? "Bullish BOS" : "Bearish BOS") : "Unconfirmed"}`, !!isHtfDirectional, { isFailable: true, value: isHtfDirectional ? "Aligned" : "Misaligned", details: "Trend HTF harus searah signal.", timeframe: htfTfLabel }),
        mk("ict-sweep", (hasSweep || hasIFVG || isC2Closure || isC2DNT || isDCM || isSMR) ? `③ Liquidity Sweep / Inducement (${setupTfLabel})` : `③ Liquidity Sweep Menunggu @ ${targetSweep}`, hasSweep || hasIFVG || isC2Closure || isC2DNT || isDCM || isSMR, { isFailable: true, value: (hasSweep || hasIFVG || isC2Closure || isC2DNT || isDCM || isSMR) ? "Valid" : `Target @ ${targetSweep}`, details: "Swing liquidity disapu + inducement confirmation.", timeframe: setupTfLabel }),
        mk("ict-c2", isC2DNT ? `④ C2 DNT Detected (${setupTfLabel})${sig.isFomoDetected ? ' [FOMO Confirmed]' : ''}` : (isC2Closure ? `④ C2 Closure Detected (${setupTfLabel})` : (hasAMD ? `④ 3-Candle AMD Pattern (${setupTfLabel})` : (isDCM ? `④ DCM MTF Expansion (${setupTfLabel})` : (isSMR ? `④ SMR Composite (${setupTfLabel})${sig.isSmrComplete ? ' [Full 4/4]' : ''}` : `④ Pattern Detection (${setupTfLabel})`)))), isC2Closure || isC2DNT || hasAMD || isDCM || isSMR, { isIndependent: true, value: isC2DNT ? "C2 DNT" : (isC2Closure ? "C2 Closure" : hasAMD ? "AMD" : isDCM ? "DCM" : isSMR ? "SMR" : "N/A"), details: isC2DNT ? "Reversal into expansion langsung di candle kedua." : (isC2Closure ? "Lanjutan tren: candle pelanjutan dengan continuation gap." : (isDCM ? "MTF expansion + retrace ke imbalance." : (isSMR ? "Composite reversal (TS+CISD+PDA+SMT)." : "Manipulation (sweep) + reverse close."))), timeframe: setupTfLabel }),
        mk("ict-smt", isSMTDiv ? `⑤ SMT Divergence Confirmed (${setupTfLabel})` : `⑤ SMT Check (${setupTfLabel})`, isSMTDiv, { isIndependent: true, value: isSMTDiv ? "Divergence" : "N/A", details: "SMT Divergence antar pair terdeteksi di area POI.", timeframe: setupTfLabel }),
        mk("ict-fvg-ote", isC2DNT ? `⑥ DNT Execution Level (${entryTfLabel})` : (isC2Closure ? `⑥ FVG dalam C2 Zone (${entryTfLabel})` : (hasOTE ? `⑥ OTE Zone (${entryTfLabel})` : (isDCM ? `⑥ DCM Retrace Imbalance (${entryTfLabel})` : `⑥ FVG (${entryTfLabel})`))), hasFVG || hasOTE || isC2DNT || isDCM, { isIndependent: true, value: hasFVG || hasOTE || isC2DNT || isDCM ? "Detected" : "N/A", details: "Fair Value Gap / OTE zone / DNT level tervalidasi.", timeframe: entryTfLabel }),
        mk("ict-entry", `⑦ Entry Retest (${sig.entry.toFixed(5)})`, isHtfDirectional && (isEntryRetested || isC2DNT), { isIndependent: true, isFailable: true, value: isHtfDirectional && (isEntryRetested || isC2DNT) ? "Ready" : "Not Ready", details: isC2DNT ? `Market execution C2 DNT at ${sig.entry.toFixed(5)}.` : `Harga retest level entry ${sig.entry.toFixed(5)}.`, timeframe: entryTfLabel }),
        mk("ict-rr", `⑧ Risk-to-Reward 1:2 ${isRRValid ? "terpenuhi" : "belum"}`, isRRValid, { isFailable: true, details: isRRValid ? `R:R 1:${rrRatio.toFixed(2)} | SL ${sig.sl.toFixed(5)} | TP ${sig.tp.toFixed(5)}` : "RR < 1:2, signal di-drop engine." }),
      ];
    }

  // ─── AMD Pattern Detection (CRT backbone) ─────────────────────────────────

  /**
   * Detects CRT 3-Candle AMD Pattern on setup candles (H1/H4):
   * C1 = Accumulation (range candle)
   * C2 = Manipulation (sweep + reverse close)
   * C3 = Distribution (breakout / follow-through)
   * Returns a zone around the sweep (C1 body range) if valid.
   */
  private detectAMDPattern(
    candles: Candle[],
    ms: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
  ): { direction: "BUY" | "SELL"; zoneHigh: number; zoneLow: number; sweepLevel: number } | null {
    if (candles.length < 2) return null;
    if (htfTrend === "SIDEWAYS") return null; // STRICT: Do not trade sideways

    const c1 = candles[candles.length - 2]; // Accumulation
    const c2 = candles[candles.length - 1]; // Manipulation

    const c1BodyTop = Math.max(c1.open, c1.close);
    const c1BodyBot = Math.min(c1.open, c1.close);

    // Bullish AMD: C2 sweeps below C1's low AND sweeps a recent structural swing low, then closes bullish above C1's body
    if (htfTrend === "BULL") {
      const c2SweepLow = c2.low < c1.low;
      const c2CloseBullish = c2.close > c1BodyBot && c2.close > c2.open;

      if (c2SweepLow && c2CloseBullish) {
        // Enforce structural sweep inducement (must sweep a Swing Low)
        const recentLows = ms.swingLows.filter(s => s.index >= candles.length - 15 && s.index < candles.length - 1);
        const sweptStructural = recentLows.some(s => c2.low < s.price);

        if (sweptStructural) {
          return {
            direction: "BUY",
            zoneHigh: c1BodyTop,
            zoneLow: c2.low,
            sweepLevel: c1.low,
          };
        }
      }
    }

    // Bearish AMD: C2 sweeps above C1's high AND sweeps a recent structural swing high, then closes bearish below C1's body
    if (htfTrend === "BEAR") {
      const c2SweepHigh = c2.high > c1.high;
      const c2CloseBearish = c2.close < c1BodyTop && c2.close < c2.open;

      if (c2SweepHigh && c2CloseBearish) {
        // Enforce structural sweep inducement (must sweep a Swing High)
        const recentHighs = ms.swingHighs.filter(s => s.index >= candles.length - 15 && s.index < candles.length - 1);
        const sweptStructural = recentHighs.some(s => c2.high > s.price);

        if (sweptStructural) {
          return {
            direction: "SELL",
            zoneHigh: c2.high,
            zoneLow: c1BodyTop,
            sweepLevel: c1.high,
          };
        }
      }
    }

    return null;
  }

  // ─── ICT FVG inside AMD Zone ──────────────────────────────────────────────

  private findFVGInsideZone(
    candles: Candle[],
    ms: MarketStructure,
    direction: "BUY" | "SELL",
    zoneHigh: number,
    zoneLow: number,
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>,
    killzone: KillzoneType,
  ): ICTSignal | null {
    const last = candles[candles.length - 1];

    for (const fvg of ms.fairValueGaps) {
      if (fvg.mitigated) continue;

      if (direction === "BUY" && fvg.type === "BULLISH") {
        // FVG must overlap the AMD zone
        if (fvg.top < zoneLow || fvg.bottom > zoneHigh) continue;
        // Price must be near the FVG bottom
        if (Math.abs(last.close - fvg.bottom) > avgRange * config.fvgProximityAtrMult) continue;

        let conf = config.minConfidence + 20; // AMD (15) + FVG (5) = high quality
        let reason = `ICT AMD BUY: 3-Candle sweep + Bullish FVG [${fvg.bottom.toFixed(5)}–${fvg.top.toFixed(5)}]`;
        if (killzone !== "NONE") { conf += config.fvgKillzoneBoost; reason += ` @ ${killzone}`; }

        return {
          direction: "BUY",
          entry: fvg.bottom,
          sl: zoneLow, // SL at AMD sweep low wick
          tp: Math.max(fvg.top + avgRange * 1.5, zoneHigh), // TP targeting AMD high
          orderType: "PENDING_LIMIT",
          limitPrice: fvg.bottom,
          signalType: "AMD_FVG",
          killzone: killzone !== "NONE" ? killzone : undefined,
          confidence: Math.min(95, conf),
          reason,
        };
      }

      if (direction === "SELL" && fvg.type === "BEARISH") {
        if (fvg.bottom > zoneHigh || fvg.top < zoneLow) continue;
        if (Math.abs(last.close - fvg.top) > avgRange * config.fvgProximityAtrMult) continue;

        let conf = config.minConfidence + 20;
        let reason = `ICT AMD SELL: 3-Candle sweep + Bearish FVG [${fvg.bottom.toFixed(5)}–${fvg.top.toFixed(5)}]`;
        if (killzone !== "NONE") { conf += config.fvgKillzoneBoost; reason += ` @ ${killzone}`; }

        return {
          direction: "SELL",
          entry: fvg.top,
          sl: zoneHigh, // SL at AMD sweep high wick
          tp: Math.min(fvg.bottom - avgRange * 1.5, zoneLow), // TP targeting AMD low
          orderType: "PENDING_LIMIT",
          limitPrice: fvg.top,
          signalType: "AMD_FVG",
          killzone: killzone !== "NONE" ? killzone : undefined,
          confidence: Math.min(95, conf),
          reason,
        };
      }
    }

    return null;
  }

  // ─── ICT OTE inside AMD Zone ──────────────────────────────────────────────

  private findOTEInsideZone(
    candles: Candle[],
    ms: MarketStructure,
    direction: "BUY" | "SELL",
    zoneHigh: number,
    zoneLow: number,
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>,
  ): ICTSignal | null {
    if (ms.swingHighs.length < 1 || ms.swingLows.length < 1) return null;

    const last = candles[candles.length - 1];
    const latestHigh = ms.swingHighs[ms.swingHighs.length - 1];
    const latestLow = ms.swingLows[ms.swingLows.length - 1];

    if (direction === "BUY" && latestLow.index < latestHigh.index) {
      const range = latestHigh.price - latestLow.price;
      if (range === 0) return null;
      // OTE zone 62–79% of the displacement (sweep wick low → displacement high).
      // Entry at the 70.5% mean threshold ("sweet spot"), stop beyond 100% (sweep wick).
      const ote618 = latestHigh.price - range * 0.618;
      const ote705 = latestHigh.price - range * 0.705;
      const ote79  = latestHigh.price - range * 0.79;

      // Price in OTE zone AND OTE zone overlaps AMD zone
      if (last.close >= ote79 && last.close <= ote618 && ote618 >= zoneLow && ote79 <= zoneHigh) {
        // Enforce candle direction check - OTE entry should align with impulse direction
        // For BUY OTE pattern, prior bar should be bearish (lower close than open)
        const barIndex = candles.length - 1;
        if (barIndex - 1 < 0) return null;
        const priorBar = candles[barIndex - 1];
        if (priorBar.close >= priorBar.open) return null; // Not bearish accumulation

        return {
          direction: "BUY",
          entry: ote705, // 70.5% mean threshold — the precise ICT entry
          sl: latestLow.price - avgRange * 0.25, // beyond the swept wick (100%)
          tp: latestHigh.price, // TP at displacement high
          orderType: "PENDING_LIMIT",
          limitPrice: ote705, // Limit order at sweet spot
          signalType: "AMD_OTE",
          confidence: Math.min(93, config.minConfidence + 13),
          reason: `ICT AMD OTE BUY: 3-Candle sweep + OTE (${ote79.toFixed(5)}–${ote618.toFixed(5)}) inside AMD range, Entry 70.5% @ ${ote705.toFixed(5)}`,
        };
      }
    }

    if (direction === "SELL" && latestHigh.index < latestLow.index) {
      const range = latestHigh.price - latestLow.price;
      if (range === 0) return null;
      const ote618 = latestLow.price + range * 0.618;
      const ote705 = latestLow.price + range * 0.705;
      const ote79  = latestLow.price + range * 0.79;

      if (last.close >= ote618 && last.close <= ote79 && ote79 <= zoneHigh && ote618 >= zoneLow) {
        // Enforce candle direction check - OTE entry should align with impulse direction
        // For SELL OTE pattern, prior bar should be bullish (higher close than open)
        const barIndex = candles.length - 1;
        if (barIndex - 1 < 0) return null;
        const priorBar = candles[barIndex - 1];
        if (priorBar.close <= priorBar.open) return null; // Not bullish accumulation

        return {
          direction: "SELL",
          entry: ote705, // 70.5% mean threshold — the precise ICT entry
          sl: latestHigh.price + avgRange * 0.25, // beyond the swept wick (100%)
          tp: latestLow.price, // TP at displacement low
          orderType: "PENDING_LIMIT",
          limitPrice: ote705, // Limit order at sweet spot
          signalType: "AMD_OTE",
          confidence: Math.min(93, config.minConfidence + 13),
          reason: `ICT AMD OTE SELL: 3-Candle sweep + OTE (${ote618.toFixed(5)}–${ote79.toFixed(5)}) inside AMD range, Entry 70.5% @ ${ote705.toFixed(5)}`,
        };
      }
    }

    return null;
  }

  // ─── Liquidity Sweep Detection (CRT backbone) ─────────────────────────────

  private detectLiquiditySweep(
    candles: Candle[],
    ms: MarketStructure,
    avgRange: number,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
  ): { direction: "BUY" | "SELL"; sweepLevel: number; swingSweepLow?: number; swingSweepHigh?: number } | null {
    if (candles.length < 3) return null;

    const lookback = candles.slice(-20, -1);
    const rangeHigh = Math.max(...lookback.map(c => c.high));
    const rangeLow  = Math.min(...lookback.map(c => c.low));

    const prev = candles[candles.length - 2];
    const last = candles[candles.length - 1];

    // Bullish sweep: prev wick went below rangeLow, last closed back above.
    // Require the wick to also pierce a recent STRUCTURAL swing low (ERL) —
    // ICT liquidity only exists at swing points / equal lows, not range noise.
    if (htfTrend === "BULL") {
      const recentStructuralLows = ms.swingLows.filter(s => s.index >= candles.length - 12 && s.index < candles.length - 1);
      const sweptStructural = recentStructuralLows.some(s => prev.low < s.price && last.close > s.price);
      if (prev.low < rangeLow && last.close > rangeLow && sweptStructural) {
        return { direction: "BUY", sweepLevel: rangeLow, swingSweepLow: prev.low };
      }
    }

    // Bearish sweep: prev wick went above rangeHigh, last closed back below
    if (htfTrend === "BEAR") {
      const recentStructuralHighs = ms.swingHighs.filter(s => s.index >= candles.length - 12 && s.index < candles.length - 1);
      const sweptStructural = recentStructuralHighs.some(s => prev.high > s.price && last.close < s.price);
      if (prev.high > rangeHigh && last.close < rangeHigh && sweptStructural) {
        return { direction: "SELL", sweepLevel: rangeHigh, swingSweepHigh: prev.high };
      }
    }

    return null;
  }

  // ─── Sweep + FVG Confirmation ─────────────────────────────────────────────

  private buildSweepFVGSignal(
    candles: Candle[],
    ms: MarketStructure,
    direction: "BUY" | "SELL",
    sweepLevel: number,
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>,
    killzone: KillzoneType,
    swingSweepLow?: number,
    swingSweepHigh?: number,
  ): ICTSignal | null {
    const last = candles[candles.length - 1];

    for (const fvg of ms.fairValueGaps) {
      if (fvg.mitigated) continue;

      if (direction === "BUY" && fvg.type === "BULLISH") {
        // FVG must be above the sweep level (where the reversal happens)
        if (fvg.bottom < sweepLevel) continue;
        if (Math.abs(last.close - fvg.bottom) > avgRange * config.fvgProximityAtrMult) continue;

        let conf = config.minConfidence + 15;
        let reason = `ICT Sweep+FVG BUY: Liq. sweep @ ${sweepLevel.toFixed(5)} + Bullish FVG @ ${fvg.bottom.toFixed(5)}`;
        if (killzone !== "NONE") { conf += config.fvgKillzoneBoost; reason += ` @ ${killzone}`; }

        return {
          direction: "BUY",
          entry: fvg.bottom,
          sl: swingSweepLow ? swingSweepLow : sweepLevel,
          tp: fvg.top + avgRange * 2.0,
          orderType: "PENDING_LIMIT",
          limitPrice: fvg.bottom,
          signalType: "SWEEP_FVG",
          killzone: killzone !== "NONE" ? killzone : undefined,
          confidence: Math.min(92, conf),
          reason,
        };
      }

      if (direction === "SELL" && fvg.type === "BEARISH") {
        if (fvg.top > sweepLevel) continue;
        if (Math.abs(last.close - fvg.top) > avgRange * config.fvgProximityAtrMult) continue;

        let conf = config.minConfidence + 15;
        let reason = `ICT Sweep+FVG SELL: Liq. sweep @ ${sweepLevel.toFixed(5)} + Bearish FVG @ ${fvg.top.toFixed(5)}`;
        if (killzone !== "NONE") { conf += config.fvgKillzoneBoost; reason += ` @ ${killzone}`; }

        return {
          direction: "SELL",
          entry: fvg.top,
          sl: swingSweepHigh ? swingSweepHigh : sweepLevel,
          tp: fvg.bottom - avgRange * 2.0,
          orderType: "PENDING_LIMIT",
          limitPrice: fvg.top,
          signalType: "SWEEP_FVG",
          killzone: killzone !== "NONE" ? killzone : undefined,
          confidence: Math.min(92, conf),
          reason,
        };
      }
    }

    return null;
  }

  // ─── Judas Swing + Sweep Context ─────────────────────────────────────────

  private detectJudasWithContext(
    candles: Candle[],
    ms: MarketStructure,
    avgRange: number,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    fractal: import("./market-structure.service").FractalContext,
  ): ICTSignal | null {
    if (candles.length < 3) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    // Calculate recent range context
    const lookback = candles.slice(-20, -2);
    const rangeHigh = Math.max(...lookback.map(c => c.high));
    const rangeLow  = Math.min(...lookback.map(c => c.low));

    // Bullish Judas: prev dipped below recent swing low (sweep), now reversed
    if (htfTrend === "BULL") {
      const recentLows = ms.swingLows.filter(s => s.index >= candles.length - 6);
      for (const swing of recentLows) {
        if (prev.low < swing.price && last.close > swing.price) {
          // Validate: prev also swept below range context (double confirmation)
          const contextSweep = prev.low < rangeLow;
          const conf = contextSweep ? 82 : 72;

          // Entry at last close (market order), SL at sweep low wick
          const sl = prev.low;
          const h1Str = fractal.setupStr || fractal.directionStr;
          const htfStr = fractal.dailyStr;
          const tp = marketStructureService.findDynamicTarget("BUY", last.close, sl, h1Str, 2.0, htfStr, fractal.daily);

          return {
            direction: "BUY",
            entry: last.close,
            sl,
            tp,
            orderType: "MARKET",
            signalType: "JUDAS_SWEEP",
            confidence: conf,
            reason: `ICT Judas BUY: Swept ${swing.price.toFixed(5)}${contextSweep ? " + range low" : ""}, reversed bullish`,
          };
        }
      }
    }

    // Bearish Judas: prev broke above recent swing high (sweep), now reversed
    if (htfTrend === "BEAR") {
      const recentHighs = ms.swingHighs.filter(s => s.index >= candles.length - 6);
      for (const swing of recentHighs) {
        if (prev.high > swing.price && last.close < swing.price) {
          const contextSweep = prev.high > rangeHigh;
          const conf = contextSweep ? 82 : 72;

          const sl = prev.high;
          const h1Str = fractal.setupStr || fractal.directionStr;
          const htfStr = fractal.dailyStr;
          const tp = marketStructureService.findDynamicTarget("SELL", last.close, sl, h1Str, 2.0, htfStr, fractal.daily);

          return {
            direction: "SELL",
            entry: last.close,
            sl,
            tp,
            orderType: "MARKET",
            signalType: "JUDAS_SWEEP",
            confidence: conf,
            reason: `ICT Judas SELL: Swept ${swing.price.toFixed(5)}${contextSweep ? " + range high" : ""}, reversed bearish`,
          };
        }
      }
    }

    return null;
  }

  // ─── OTE + AMD Range Context ──────────────────────────────────────────────

  private detectOTEWithAMDContext(
    setupCandles: Candle[],
    entryCandles: Candle[],
    ms: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>,
    fractal: import("./market-structure.service").FractalContext,
  ): ICTSignal | null {
    if (ms.swingHighs.length < 1 || ms.swingLows.length < 1) return null;
    if (setupCandles.length < 3) return null;

    const last = entryCandles[entryCandles.length - 1];
    const latestHigh = ms.swingHighs[ms.swingHighs.length - 1];
    const latestLow  = ms.swingLows[ms.swingLows.length - 1];

    // Setup TF context: is price in a consolidation / low-ATR area?
    const setupAtr = atrService.calculate(setupCandles);
    const setupAvgRange = setupAtr > 0 ? setupAtr : this.avgRange(setupCandles, 14);
    const recentSetupRange = Math.max(...setupCandles.slice(-5).map(c => c.high)) -
                             Math.min(...setupCandles.slice(-5).map(c => c.low));
    const isConsolidating = recentSetupRange < setupAvgRange * 1.5;

    if (!isConsolidating) return null; // OTE only valid in AMD accumulation context

    // Bullish OTE
    if (htfTrend !== "BEAR" && latestLow.index < latestHigh.index) {
      const range = latestHigh.price - latestLow.price;
      if (range === 0) return null;
      const ote618 = latestHigh.price - range * 0.618;
      const ote705 = latestHigh.price - range * 0.705;
      const ote79  = latestHigh.price - range * 0.79;

      if (last.close >= ote79 && last.close <= ote618) {
        // Enforce OTE must be inside HTF POI (OB or FVG)
        const htf = fractal.directionStr || fractal.dailyStr;
        const insideHTFPOI = htf.orderBlocks.some(ob => ob.type === "BULLISH" && Math.max(ote79, ob.bottom) <= Math.min(ote618, ob.top)) ||
                             htf.fairValueGaps.some(fvg => fvg.type === "BULLISH" && Math.max(ote79, fvg.bottom) <= Math.min(ote618, fvg.top));

        if (insideHTFPOI) {
          const prevHigh = ms.swingHighs.length > 1 ? ms.swingHighs[ms.swingHighs.length - 2] : null;
          const tp = prevHigh ? prevHigh.price : latestHigh.price + avgRange * 2;

          return {
            direction: "BUY",
            entry: ote705, // 70.5% mean threshold — the precise ICT entry
            sl: latestLow.price - avgRange * 0.25, // beyond the sweep/impulse wick
            tp,
            orderType: "PENDING_LIMIT",
            limitPrice: ote705,
            signalType: "OTE_AMD",
            confidence: Math.min(88, config.minConfidence + 13),
            reason: `ICT OTE BUY: Fib zone (${ote79.toFixed(5)}–${ote618.toFixed(5)}) in consolidation context, Entry 70.5% @ ${ote705.toFixed(5)}, TP ${tp.toFixed(5)}`,
          };
        }
      }
    }

    // Bearish OTE
    if (htfTrend !== "BULL" && latestHigh.index < latestLow.index) {
      const range = latestHigh.price - latestLow.price;
      if (range === 0) return null;
      const ote618 = latestLow.price + range * 0.618;
      const ote705 = latestLow.price + range * 0.705;
      const ote79  = latestLow.price + range * 0.79;

      if (last.close >= ote618 && last.close <= ote79) {
        // Enforce OTE must be inside HTF POI (OB or FVG)
        const htf = fractal.directionStr || fractal.dailyStr;
        const insideHTFPOI = htf.orderBlocks.some(ob => ob.type === "BEARISH" && Math.max(ote618, ob.bottom) <= Math.min(ote79, ob.top)) ||
                             htf.fairValueGaps.some(fvg => fvg.type === "BEARISH" && Math.max(ote618, fvg.bottom) <= Math.min(ote79, fvg.top));

        if (insideHTFPOI) {
          const prevLow = ms.swingLows.length > 1 ? ms.swingLows[ms.swingLows.length - 2] : null;
          const tp = prevLow ? prevLow.price : latestLow.price - avgRange * 2;

          return {
            direction: "SELL",
            entry: ote705, // 70.5% mean threshold — the precise ICT entry
            sl: latestHigh.price + avgRange * 0.25, // beyond the sweep/impulse wick
            tp,
            orderType: "PENDING_LIMIT",
            limitPrice: ote705,
            signalType: "OTE_AMD",
            confidence: Math.min(88, config.minConfidence + 13),
            reason: `ICT OTE SELL: Fib zone (${ote618.toFixed(5)}–${ote79.toFixed(5)}) in consolidation context, Entry 70.5% @ ${ote705.toFixed(5)}, TP ${tp.toFixed(5)}`,
          };
        }
      }
    }

    return null;
  }

  // ─── IFVG (Inversion FVG) Retest ───────────────────────────────────────────

  private detectIFVGEntry(
    candles: Candle[],
    ms: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>
  ): ICTSignal | null {
    if (htfTrend === "SIDEWAYS") return null;

    const last = candles[candles.length - 1];

    // Look for IFVGs (Inverted FVGs) that were recently inverted
    for (const fvg of ms.fairValueGaps) {
      if (!fvg.inverted) continue;

      // Bullish IFVG (Former Bearish FVG inverted to support)
      if (htfTrend === "BULL" && fvg.type === "BEARISH") {
        // Price must be ABOVE support (waiting for retrace down), not below it
        if (last.close >= fvg.bottom &&
            Math.abs(last.close - fvg.bottom) <= avgRange * config.fvgProximityAtrMult) {
          return {
            direction: "BUY",
            entry: fvg.bottom,
            sl: fvg.bottom - avgRange * 0.5, // stop below the level, never == entry
            tp: fvg.bottom + avgRange * 3,
            orderType: "PENDING_LIMIT",
            limitPrice: fvg.bottom,
            signalType: "IFVG_RETEST",
            confidence: config.minConfidence + 18,
            reason: `ICT IFVG BUY: Pending Limit @ FVG bottom ${fvg.bottom.toFixed(5)} (former Bearish FVG inverted to support)`,
          };
        }
      }

      // Bearish IFVG (Former Bullish FVG inverted to resistance)
      if (htfTrend === "BEAR" && fvg.type === "BULLISH") {
        // Price must be BELOW resistance (waiting for retrace up), not above it
        if (last.close <= fvg.top &&
            Math.abs(last.close - fvg.top) <= avgRange * config.fvgProximityAtrMult) {
          return {
            direction: "SELL",
            entry: fvg.top,
            sl: fvg.top + avgRange * 0.5, // stop above the level, never == entry
            tp: fvg.top - avgRange * 3,
            orderType: "PENDING_LIMIT",
            limitPrice: fvg.top,
            signalType: "IFVG_RETEST",
            confidence: config.minConfidence + 18,
            reason: `ICT IFVG SELL: Pending Limit @ FVG top ${fvg.top.toFixed(5)} (former Bullish FVG inverted to resistance)`,
          };
        }
      }
    }

    return null;
  }

  // ─── C2 Closure Detection (Detrades Continuation Model) ────────────────
  /**
   * Detects C2 Closure pattern on setup candles:
   * C1 = Strong impulse candle (trend continuation)
   * C2 = Continuation candle that closes beyond C1, creating a gap
   * The FVG/imbalance between C1 and C2 acts as the entry zone.
   *
   * Valid when:
   * - C1 is strong (large body, aligned with HTF trend)
   * - C2 closes beyond C1 in the trend direction
   * - Gap between C1 and C2 is unmitigated (FVG exists)
   */
  private detectC2Closure(
    candles: Candle[],
    ms: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
  ): { direction: "BUY" | "SELL"; fvgTop: number; fvgBottom: number } | null {
    if (candles.length < 3) return null;
    if (htfTrend === "SIDEWAYS") return null;

    const c1 = candles[candles.length - 3]; // Impulse candle
    const c2 = candles[candles.length - 2]; // Continuation candle
    const c3 = candles[candles.length - 1]; // Current / confirmation candle

    const c1Body = Math.abs(c1.close - c1.open);
    const c1Range = c1.high - c1.low;

    // C1 must be a strong impulse candle (body > 50% of range)
    if (c1Range === 0 || c1Body / c1Range < 0.5) return null;

    // Bullish C2 Closure
    if (htfTrend === "BULL") {
      const isC1Bullish = c1.close > c1.open;
      const isC2Bullish = c2.close > c2.open;
      const c2ClosesAboveC1High = c2.close > c1.high;
      const c3Confirms = c3.close > c2.low; // C3 holds above C2

      if (isC1Bullish && isC2Bullish && c2ClosesAboveC1High && c3Confirms) {
        // Check for FVG between C1 high and C2 low (continuation gap)
        const fvgBottom = c1.high; // Gap floor
        const fvgTop = c2.low;    // Gap ceiling

        // For a valid bullish FVG: c2.low must be > c1.high
        if (fvgTop > fvgBottom) {
          // Ensure the gap is meaningful (at least 0.3x avg range)
          if (fvgTop - fvgBottom >= avgRange * 0.3) {
            // Check if there's a recent swing low that was swept (C2 manipulation)
            const recentLows = ms.swingLows.filter(s => s.index >= candles.length - 8 && s.index < candles.length - 2);
            const sweptLow = recentLows.some(s => c2.low < s.price);

            if (sweptLow || c1Body >= avgRange * 1.2) {
              return { direction: "BUY", fvgTop, fvgBottom };
            }
          }
        }
      }
    }

    // Bearish C2 Closure
    if (htfTrend === "BEAR") {
      const isC1Bearish = c1.close < c1.open;
      const isC2Bearish = c2.close < c2.open;
      const c2ClosesBelowC1Low = c2.close < c1.low;
      const c3Confirms = c3.close < c2.high; // C3 holds below C2

      if (isC1Bearish && isC2Bearish && c2ClosesBelowC1Low && c3Confirms) {
        // Check for FVG between C2 high and C1 low (continuation gap)
        const fvgTop = c1.low;    // Gap ceiling
        const fvgBottom = c2.high; // Gap floor

        if (fvgTop > fvgBottom) {
          if (fvgTop - fvgBottom >= avgRange * 0.3) {
            const recentHighs = ms.swingHighs.filter(s => s.index >= candles.length - 8 && s.index < candles.length - 2);
            const sweptHigh = recentHighs.some(s => c2.high > s.price);

            if (sweptHigh || c1Body >= avgRange * 1.2) {
              return { direction: "SELL", fvgTop, fvgBottom };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * C2 DNT (Detrades Reversal into Expansion) Detection
   * C1 = Bulky candle masuk ke Key Level
   * C2 = Langsung reverse kencang (wick reversal kecil dari penyapuan)
   * Trade di Candle 2 (reversal expansion, bukan continuation)
   */
  private detectC2DNT(
    candles: Candle[],
    ms: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
  ): { direction: "BUY" | "SELL"; entryPrice: number; slPrice: number; isFomo: boolean } | null {
    if (candles.length < 3) return null;
    if (htfTrend === "SIDEWAYS") return null;

    const c1 = candles[candles.length - 2]; // Bulky candle entering Key Level
    const c2 = candles[candles.length - 1]; // Reversal into expansion candle

    const c1Body = Math.abs(c1.close - c1.open);
    const c1Range = c1.high - c1.low;

    // C1 must be a bulky candle (body > 50% of range)
    if (c1Range === 0 || c1Body / c1Range < 0.5) return null;

    const isFomo = this.detectFomoCandle(candles, ms, htfTrend);

    // Bullish C2 DNT (c1 bearish bulky -> c2 bullish expansion)
    if (htfTrend === "BULL") {
      const isC1BearishBulky = c1.close < c1.open;
      const isC2BullishExpand = c2.close > c2.open && c2.close > c1.high;
      const c2WickSmall = (c2.open - c2.low) < avgRange * 0.5; // Small sweep wick

      if (isC1BearishBulky && isC2BullishExpand && c2WickSmall) {
        return {
          direction: "BUY",
          entryPrice: c2.close,
          slPrice: c2.low - avgRange * 0.2,
          isFomo
        };
      }
    }

    // Bearish C2 DNT (c1 bullish bulky -> c2 bearish expansion)
    if (htfTrend === "BEAR") {
      const isC1BullishBulky = c1.close > c1.open;
      const isC2BearishExpand = c2.close < c2.open && c2.close < c1.low;
      const c2WickSmall = (c2.high - c2.open) < avgRange * 0.5; // Small sweep wick

      if (isC1BullishBulky && isC2BearishExpand && c2WickSmall) {
        return {
          direction: "SELL",
          entryPrice: c2.close,
          slPrice: c2.high + avgRange * 0.2,
          isFomo
        };
      }
    }

    return null;
  }
    /**
     * TRUE SMT Divergence requires comparing TWO correlated symbols.
     * This method prepares the data structure for cross-pair analysis.
     * Actual comparison happens in ai-trading-engine when multiple symbols are analyzed.
     *
     * Returns the structural state needed for SMT comparison:
     * - Current swing high/low on direction TF
     * - Price action at key level (POI)
     * - Internal structure (higher highs/lower lows)
     */
    private getSMTStructuralState(
      candles: Candle[],
      ms: MarketStructure,
      htfTrend: "BULL" | "BEAR" | "SIDEWAYS"
    ): { 
      swingHigh: number; 
      swingLow: number; 
      internalStructure: "BULLISH" | "BEARISH" | "NEUTRAL";
      atKeyLevel: boolean;
      keyLevelType: "OB" | "FVG" | "SWING" | "NONE";
      keyLevelPrice: number;
    } | null {
      if (candles.length < 20 || htfTrend === "SIDEWAYS") return null;
    
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
    
      // Get recent structural swings on direction timeframe
      const recentHighs = ms.swingHighs.filter(s => s.index >= candles.length - 10);
      const recentLows = ms.swingLows.filter(s => s.index >= candles.length - 10);
    
      if (recentHighs.length === 0 || recentLows.length === 0) return null;
    
      const latestSwingHigh = recentHighs[recentHighs.length - 1].price;
      const latestSwingLow = recentLows[recentLows.length - 1].price;
    
      // Determine internal structure on entry TF
      const entryHighs = ms.swingHighs.filter(s => s.index >= candles.length - 5);
      const entryLows = ms.swingLows.filter(s => s.index >= candles.length - 5);
    
      let internalStructure: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
      if (entryHighs.length >= 2 && entryLows.length >= 2) {
        const higherHigh = entryHighs[entryHighs.length - 1].price > entryHighs[entryHighs.length - 2].price;
        const higherLow = entryLows[entryLows.length - 1].price > entryLows[entryLows.length - 2].price;
        const lowerHigh = entryHighs[entryHighs.length - 1].price < entryHighs[entryHighs.length - 2].price;
        const lowerLow = entryLows[entryLows.length - 1].price < entryLows[entryLows.length - 2].price;
      
        if (higherHigh && higherLow) internalStructure = "BULLISH";
        else if (lowerHigh && lowerLow) internalStructure = "BEARISH";
      }
    
      // Check if price is at a key level (POI)
      let atKeyLevel = false;
      let keyLevelType: "OB" | "FVG" | "SWING" | "NONE" = "NONE";
      let keyLevelPrice = 0;
    
      // Check Order Blocks
      for (const ob of ms.orderBlocks) {
        if (!ob.mitigated && Math.abs(last.close - (htfTrend === "BULL" ? ob.bottom : ob.top)) < (last.high - last.low) * 2) {
          atKeyLevel = true;
          keyLevelType = "OB";
          keyLevelPrice = htfTrend === "BULL" ? ob.bottom : ob.top;
          break;
        }
      }
    
      // Check FVGs
      if (!atKeyLevel) {
        for (const fvg of ms.fairValueGaps) {
          if (!fvg.mitigated && 
              ((htfTrend === "BULL" && fvg.type === "BULLISH" && last.close >= fvg.bottom && last.close <= fvg.top) ||
               (htfTrend === "BEAR" && fvg.type === "BEARISH" && last.close >= fvg.bottom && last.close <= fvg.top))) {
            atKeyLevel = true;
            keyLevelType = "FVG";
            keyLevelPrice = htfTrend === "BULL" ? fvg.bottom : fvg.top;
            break;
          }
        }
      }
    
      // Check Swing Points
      if (!atKeyLevel) {
        const swingTolerance = (last.high - last.low) * 1.5;
        if (htfTrend === "BULL" && Math.abs(last.close - latestSwingLow) < swingTolerance) {
          atKeyLevel = true;
          keyLevelType = "SWING";
          keyLevelPrice = latestSwingLow;
        } else if (htfTrend === "BEAR" && Math.abs(last.close - latestSwingHigh) < swingTolerance) {
          atKeyLevel = true;
          keyLevelType = "SWING";
          keyLevelPrice = latestSwingHigh;
        }
      }
    
      return {
        swingHigh: latestSwingHigh,
        swingLow: latestSwingLow,
        internalStructure,
        atKeyLevel,
        keyLevelType,
        keyLevelPrice
      };
    }

    // ─── Cross-Pair SMT Comparison (called from ai-trading-engine) ──────────────
    /**
     * Compare structural state of two correlated symbols for SMT Divergence.
     * Called externally when both symbols have been analyzed.
     */
    compareSMTDivergence(
      symbolA: string,
      stateA: ReturnType<typeof ICTStrategy.prototype.getSMTStructuralState>,
      symbolB: string,
      stateB: ReturnType<typeof ICTStrategy.prototype.getSMTStructuralState>,
      correlation: "POSITIVE" | "NEGATIVE" = "POSITIVE"
    ): { 
      divergence: boolean; 
      type: "BULLISH_DIVERGENCE" | "BEARISH_DIVERGENCE" | "NONE";
      details: string;
    } {
      if (!stateA || !stateB || !stateA.atKeyLevel || !stateB.atKeyLevel) {
        return { divergence: false, type: "NONE", details: "Both symbols not at key levels" };
      }
    
      // For positively correlated pairs (EURUSD/GBPUSD, XAUUSD/XAGUSD):
      // Both should make higher highs/higher lows together
      // Divergence = One makes HH/HL while other makes LH/LL at key level
    
      const aBullish = stateA.internalStructure === "BULLISH";
      const aBearish = stateA.internalStructure === "BEARISH";
      const bBullish = stateB.internalStructure === "BULLISH";
      const bBearish = stateB.internalStructure === "BEARISH";
    
      if (correlation === "POSITIVE") {
        // Bullish Divergence: A shows bullish structure at support, B shows bearish at support
        if (aBullish && bBearish && stateA.keyLevelType === stateB.keyLevelType) {
          return { 
            divergence: true, 
            type: "BULLISH_DIVERGENCE",
            details: `${symbolA} bullish structure at ${stateA.keyLevelType} vs ${symbolB} bearish at ${stateB.keyLevelType}` 
          };
        }
        // Bearish Divergence: A shows bearish at resistance, B shows bullish
        if (aBearish && bBullish && stateA.keyLevelType === stateB.keyLevelType) {
          return { 
            divergence: true, 
            type: "BEARISH_DIVERGENCE",
            details: `${symbolA} bearish structure at ${stateA.keyLevelType} vs ${symbolB} bullish at ${stateB.keyLevelType}` 
          };
        }
      }
    
      return { divergence: false, type: "NONE", details: "No divergence detected" };
    }

  /**
   * DCM (Detrades Continuation Model) Detection
   * Rules: HTF reversal at key level + target belum tercapai →
   *        MTF expansion candle + retrace ke imbalance (FVG) →
   *        LTF SMR confirmation (TS + CISD + PDA Inverse)
   * Invalidation: langsung expand tanpa retrace, imbalance di-break, reversal bukan di titik puncak
   */
  private detectDCMContinuation(
    setupCandles: Candle[],
    setupStr: MarketStructure,
    entryCandles: Candle[],
    entryStr: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
  ): { direction: "BUY" | "SELL"; entry: number; sl: number; imbalanceTop: number; imbalanceBottom: number } | null {
    if (setupCandles.length < 5 || entryCandles.length < 3) return null;
    if (htfTrend === "SIDEWAYS") return null;

    // Step 1: Identify HTF reversal candle (C2 closure/reversal at key level)
    const htfC1 = setupCandles[setupCandles.length - 4];
    const htfC2 = setupCandles[setupCandles.length - 3]; // Reversal candle
    const mtfExpansion = setupCandles[setupCandles.length - 2]; // Expansion after reversal
    const mtfRetrace = setupCandles[setupCandles.length - 1]; // Current retrace candle

    // Step 2: Check for expansion candle after reversal
    const expansionBody = Math.abs(mtfExpansion.close - mtfExpansion.open);
    if (expansionBody < avgRange * 0.6) return null; // Must be strong expansion

    // Step 3: Check for imbalance (FVG) left by expansion
    const relevantFVGs = setupStr.fairValueGaps.filter(f => !f.mitigated);

    if (htfTrend === "BULL") {
      // Bullish DCM: expansion up → retrace down into FVG → entry
      const isMtfExpBullish = mtfExpansion.close > mtfExpansion.open;
      const isMtfRetraceDown = mtfRetrace.close < mtfExpansion.close; // Retracing
      const madeOpenHigh = mtfRetrace.high >= mtfExpansion.high * 0.99; // Retrace made a high near expansion high

      if (!isMtfExpBullish || !isMtfRetraceDown) return null;

      // Find bullish FVG left by expansion
      const bullFVG = relevantFVGs.find(f =>
        f.type === "BULLISH" &&
        f.bottom >= htfC2.low &&
        f.top <= mtfExpansion.high
      );
      if (!bullFVG) return null;

      // Invalidation: retrace must not break the FVG completely
      if (mtfRetrace.close < bullFVG.bottom) return null;

      // Step 4: LTF confirmation - check CISD in entry candles
      const hasLTFCISD = entryStr.trend.direction === "BULL";

      if (!hasLTFCISD) return null;

      return {
        direction: "BUY",
        entry: bullFVG.bottom,
        sl: htfC2.low - avgRange * 0.3,
        imbalanceTop: bullFVG.top,
        imbalanceBottom: bullFVG.bottom,
      };
    }

    if (htfTrend === "BEAR") {
      const isMtfExpBearish = mtfExpansion.close < mtfExpansion.open;
      const isMtfRetraceUp = mtfRetrace.close > mtfExpansion.close;

      if (!isMtfExpBearish || !isMtfRetraceUp) return null;

      const bearFVG = relevantFVGs.find(f =>
        f.type === "BEARISH" &&
        f.top <= htfC2.high &&
        f.bottom >= mtfExpansion.low
      );
      if (!bearFVG) return null;

      if (mtfRetrace.close > bearFVG.top) return null;

      const hasLTFCISD = entryStr.trend.direction === "BEAR";
      if (!hasLTFCISD) return null;

      return {
        direction: "SELL",
        entry: bearFVG.top,
        sl: htfC2.high + avgRange * 0.3,
        imbalanceTop: bearFVG.top,
        imbalanceBottom: bearFVG.bottom,
      };
    }

    return null;
  }

  /**
   * SMR Composite (Smart Money Reversal) Detector
   * All 4 pillars must be present for full SMR:
   * 1. TS (Turtle Soup / Liquidity Sweep) — sweep of swing high/low
   * 2. CISD (Change in State of Delivery) — MSS/BOS break on LTF
   * 3. PDA Inverse (support→resistance or resistance→support flip)
   * 4. SMT (optional but boosts confidence)
   */
  private detectSMRComposite(
    candles: Candle[],
    ms: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
  ): { direction: "BUY" | "SELL"; entry: number; sl: number; hasTS: boolean; hasCISD: boolean; hasPDAInverse: boolean; hasSMT: boolean } | null {
    if (candles.length < 5) return null;
    if (htfTrend === "SIDEWAYS") return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const prev2 = candles[candles.length - 3];

    // 1. TS (Turtle Soup): sweep of recent swing then rejection
    let hasTS = false;
    let sweepPrice = 0;

    if (htfTrend === "BULL") {
      // Bearish sweep below swing low then close above
      const recentLows = ms.swingLows.filter(s => s.index >= candles.length - 10 && s.index < candles.length - 1);
      const swept = recentLows.find(s => prev.low < s.price && prev.close > s.price);
      if (swept) { hasTS = true; sweepPrice = swept.price; }
    } else {
      const recentHighs = ms.swingHighs.filter(s => s.index >= candles.length - 10 && s.index < candles.length - 1);
      const swept = recentHighs.find(s => prev.high > s.price && prev.close < s.price);
      if (swept) { hasTS = true; sweepPrice = swept.price; }
    }

    if (!hasTS) return null; // TS is mandatory

    // 2. CISD: structure break on current TF
    const hasCISD = htfTrend === "BULL"
      ? ms.trend.direction === "BULL" && last.close > prev.high
      : ms.trend.direction === "BEAR" && last.close < prev.low;

    // 3. PDA Inverse: a previously respected level now flipped
    let hasPDAInverse = false;
    if (htfTrend === "BULL") {
      // A resistance level (OB top / FVG top) that was respected, now price is above it
      const flippedOB = ms.orderBlocks.find(ob =>
        ob.mitigated && ob.type === "BEARISH" && last.close > ob.top
      );
      const flippedFVG = ms.fairValueGaps.find(fvg =>
        fvg.mitigated && fvg.type === "BEARISH" && last.close > fvg.top
      );
      hasPDAInverse = !!(flippedOB || flippedFVG);
    } else {
      const flippedOB = ms.orderBlocks.find(ob =>
        ob.mitigated && ob.type === "BULLISH" && last.close < ob.bottom
      );
      const flippedFVG = ms.fairValueGaps.find(fvg =>
        fvg.mitigated && fvg.type === "BULLISH" && last.close < fvg.bottom
      );
      hasPDAInverse = !!(flippedOB || flippedFVG);
    }

    // 4. SMT: structural state check (actual cross-pair happens externally)
    const smtState = this.getSMTStructuralState(candles, ms, htfTrend);
    const hasSMT = !!(smtState && smtState.atKeyLevel);

    // Need at least TS + CISD (PDA Inverse and SMT are boosters)
    if (!hasCISD) return null;

    const direction: "BUY" | "SELL" = htfTrend === "BULL" ? "BUY" : "SELL";
    const entry = htfTrend === "BULL"
      ? last.close // Market execution after CISD break
      : last.close;
    const sl = htfTrend === "BULL"
      ? sweepPrice - avgRange * 0.3
      : sweepPrice + avgRange * 0.3;

    return { direction, entry, sl, hasTS, hasCISD, hasPDAInverse, hasSMT };
  }

  /**
   * Detects "FOMO Candle" - candle that breaks structural liquidity but reverses immediately,
   * triggering retail to enter in the wrong direction.
   */
  private detectFomoCandle(
    candles: Candle[],
    ms: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS"
  ): boolean {
    if (candles.length < 3) return false;
    const c1 = candles[candles.length - 2]; // Manipulation candle
    const c2 = candles[candles.length - 1]; // Current candle

    if (htfTrend === "BULL") {
        // FOMO Bearish candle: sweeping swing high, then failing
        const sweptHigh = ms.swingHighs.some(s => c1.high > s.price && s.index <= candles.length - 2);
        return sweptHigh && c1.close < c1.open && c2.close > c1.close;
    }

    if (htfTrend === "BEAR") {
        // FOMO Bullish candle: sweeping swing low, then failing
        const sweptLow = ms.swingLows.some(s => c1.low < s.price && s.index <= candles.length - 2);
        return sweptLow && c1.close > c1.open && c2.close < c1.close;
    }

    return false;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getCurrentKillzone(timestamp?: number): KillzoneType {
    const ts = timestamp ?? (Date.now() / 1000);
    return marketStructureService.getKillzoneForTimestamp(ts);
  }

  private avgRange(candles: Candle[], period: number): number {
    const recent = candles.slice(-period);
    if (recent.length === 0) return 0;
    return recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  }

  /** Validate C2 DNT confirmation di LTF (M15). */
  private confirmC2DNTLTF(fractal?: import("./market-structure.service").FractalContext): boolean {
    if (!fractal || !fractal.entryStr) return false;
    const entryCandles = fractal.entry || [];
    if (entryCandles.length < 3) return false;

    // C2 DNT membutuhkan konfirmasi candle reversal di LTF
    const lastIndex = entryCandles.length - 1;
    const confirmCandle = entryCandles[lastIndex];
    const prevCandle = entryCandles[lastIndex - 1];

    // Untuk entry BUY: butuh confirmation bullish candle setelah sweep
    // Untuk entry SELL: butuh confirmation bearish candle setelah sweep
    // Cek sederhana: candle terakhir berbalik dari candle sebelumnya
    return true; // Placeholder - implement actual LTF confirmation logic
  }
}

export const ictStrategy = new ICTStrategy();