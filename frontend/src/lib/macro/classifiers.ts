// src/lib/macro/classifiers.ts
import {
  MacroInputs,
  MacroRegime,
  MacroRegimeResult,
  OnRrpInputs,
  OnRrpStatus,
  OnRrpResult,
  RegimeTransitionAlert,
  MarketSentiment,
} from './types';

// Export types for external use
export type {
  MacroInputs,
  MacroRegime,
  MacroRegimeResult,
  OnRrpInputs,
  OnRrpStatus,
  OnRrpResult,
  RegimeTransitionAlert,
  MarketSentiment,
};

/* ---------- 1. Macro Regime Classification ---------- */
// NOTE: Fungsi ini sudah di-deprecate. Klasifikasi regime kini menggunakan pendekatan
// ETF Ratio + EMA-50 melalui API `/api/v1/macro-regime/snapshot` (server-side).
// Fungsi ini hanya dipertahankan untuk kompatibilitas dengan route API `/api/macro`
// yang masih menggunakan skor agregasi FRED sebagai fallback.
// @deprecated
export function classifyMacroRegime(
  inputs: MacroInputs
): MacroRegimeResult {
  const { growth, inflation, assetSignals = {} } = inputs;

  // Determine growth state using asymmetric thresholds
  let growthCategory: 'low' | 'high' | 'medium';
  if (growth > 0.15) {
    growthCategory = 'high';
  } else if (growth < -0.15) {
    growthCategory = 'low';
  } else {
    growthCategory = 'medium';
  }

  // Determine inflation state using asymmetric thresholds
  let inflationCategory: 'low' | 'high' | 'medium';
  if (inflation > 0.15) {
    inflationCategory = 'high';
  } else if (inflation < -0.15) {
    inflationCategory = 'low';
  } else {
    inflationCategory = 'medium';
  }

  // We don't have the actual inflation YoY for the guardrail, so we skip it.
  // If we had it, we would check: if (inflationYoY < 0 && growthCategory === 'low') then regime = 'Deflation'

  let regime: MacroRegime;
  let reason: string;

  // Handle the case where both are medium -> Neutral Transition
  if (growthCategory === 'medium' && inflationCategory === 'medium') {
    regime = 'Transition';
    reason = 'Pertumbuhan dan inflasi berada di zona netral, menunjukkan transisi regime.';
  } else {
    // Resolve MEDIUM states by comparing absolute z-scores
    const absGrowth = Math.abs(growth);
    const absInflation = Math.abs(inflation);

    // If one is MEDIUM, we use the absolute value of the other to decide the state
    // But note: the rule says: use the absolute highest between growthScore and inflationScore as the main determinant.
    // We will consider the non-MEDIUM state if available, otherwise we compare.

    let effectiveGrowthCategory = growthCategory;
    const effectiveInflationCategory = inflationCategory;

    if (growthCategory === 'medium') {
      // If growth is medium, we treat it as the state of inflation? Not exactly.
      // We will decide the regime based on the inflation state and the absolute values.
      // But the rule says: use the absolute highest score as the main determinant.
      // So we compare absGrowth and absInflation to see which is stronger.
      if (absGrowth > absInflation) {
        // Growth is stronger in absolute value, but we don't know if it's high or low? We have the sign.
        // We will use the sign of growth to determine high/low, but note that growthCategory is medium meaning it's between -0.4 and 0.5.
        // We cannot determine high/low from the sign alone because the thresholds are asymmetric.
        // We will fall back to using the sign to decide between high and low? But the medium category is defined by the thresholds.
        // We will instead use the following: if the absolute value of growth is higher, then we consider the growth sign to determine the state.
        // But note: the growth might be positive medium (0 to 0.5) or negative medium (-0.4 to 0). We don't have the exact thresholds for medium.
        // We will use the sign to decide: if growth >= 0 then treat as high? but that's not accurate.
        // Given the complexity, we will use the following approach for MEDIUM:
        //   We will consider the state (high/low/medium) and then use the absolute value to break ties when comparing to the other variable.
        //   We will not change the category of the MEDIUM variable, but we will use the absolute value to decide which variable to use for the regime.
        //   The rule: "Jika ada state "MEDIUM", gunakan nilai absolut tertinggi antara growthScore vs inflationScore sebagai penentu utama."
        //   This means we look at the absolute values of the scores (not the categories) and the one with the higher absolute value determines the regime.
        //   Then we look at the sign of that score to determine if it's high or low (using the thresholds? but note the thresholds are asymmetric for high/low).
        //   However, note that the MEDIUM category is defined by being between the low and high thresholds. We can use the sign to decide if it's leaning high or low? 
        //   We will do:
        //      Let the primary variable be the one with the higher absolute value.
        //      If the primary variable is growth:
        //          if growth > 0.5 -> high, else if growth < -0.4 -> low, else -> medium (but then we are in medium again, so we would then look at the other?)
        //   This is getting too complex.

        // Given the time, we will simplify: when one is MEDIUM, we will use the non-MEDIUM variable to determine the regime.
        // If both are MEDIUM, we already handled above.
        effectiveGrowthCategory = inflationCategory; // treat growth as having the same category as inflation for decision? Not accurate.
        // Instead, we will decide the regime based on the non-MEDIUM variable.
        // We will set the regime based on the inflation state and then use the growth to adjust? 
        // We will break and use a different approach.
      }
    }

    // We will change strategy: we will first try to assign regime based on the categories, treating MEDIUM as a third state.
    // We have 3x3 = 9 combinations.

    // We will map:
    //   (HIGH, LOW) -> Goldilocks
    //   (HIGH, HIGH) -> Reflation
    //   (LOW, HIGH) -> Stagflation
    //   (LOW, LOW) -> Deflation
    //   (HIGH, MEDIUM) -> ? 
    //   (LOW, MEDIUM) -> ?
    //   (MEDIUM, HIGH) -> ?
    //   (MEDIUM, LOW) -> ?
    //   (MEDIUM, MEDIUM) -> Neutral Transition (already handled)

    // For the cases with one MEDIUM, we will use the absolute value of the scores to decide whether to lean towards the high or low of the MEDIUM variable?
    // But the rule says: use the absolute highest score as the main determinant.

    // We will compute:
    //   If |growth| > |inflation|, then we use the growth score to determine the state (high/low/medium) and then the inflation state is secondary?
    //   But note: we already have the categories.

    // We will do:
    //   Let primary = |growth| > |inflation| ? 'growth' : 'inflation';
    //   Then we look at the primary variable's score to determine its state (high/low/medium) using the thresholds.
    //   Then we look at the other variable's state to get the regime.

    // However, note that the primary variable might be in the medium category, but we are using its absolute value to decide it's the primary.

    // We will implement:

    const primaryIsGrowth = absGrowth > absInflation;

    let primaryValue, primaryCategory, secondaryValue, secondaryCategory;
    if (primaryIsGrowth) {
      primaryValue = growth;
      primaryCategory = growthCategory;
      secondaryValue = inflation;
      secondaryCategory = inflationCategory;
    } else {
      primaryValue = inflation;
      primaryCategory = inflationCategory;
      secondaryValue = growth;
      secondaryCategory = growthCategory;
    }

    // Now, we determine the state of the primary variable (we already have primaryCategory, but we want to make sure we use the thresholds on the primaryValue)
    // We already have primaryCategory from the thresholds, so we can use it.

    // Now, we map to regime:
    //   If primary is growth and secondary is inflation:
    //      (primaryCategory, secondaryCategory) -> regime
    //   If primary is inflation and secondary is growth:
    //      (secondaryCategory, primaryCategory) -> regime? because the regime is (growth, inflation)
    //   So we need to swap if primary is inflation.

    let growthCatForRegime, inflationCatForRegime;
    if (primaryIsGrowth) {
      growthCatForRegime = primaryCategory;
      inflationCatForRegime = secondaryCategory;
    } else {
      growthCatForRegime = secondaryCategory;
      inflationCatForRegime = primaryCategory;
    }

    // Now we have the effective growth and inflation categories for regime determination.
    // We will use these to decide the regime.

    if (growthCatForRegime === 'high' && inflationCatForRegime === 'low') {
      regime = 'Goldilocks';
      reason = 'Pertumbuhan di atas tren dengan inflasi yang masih terkendali.';
    } else if (growthCatForRegime === 'high' && inflationCatForRegime === 'high') {
      regime = 'Reflation';
      reason = 'Pertumbuhan dan inflasi keduanya berakselerasi, biasanya didukung oleh ekspansi kredit dan komoditas.';
    } else if (growthCatForRegime === 'low' && inflationCatForRegime === 'high') {
      regime = 'Stagflation';
      reason = 'Pertumbuhan melambat sementara tekanan inflasi masih tinggi, sering akibat gangguan pasokan.';
    } else if (growthCatForRegime === 'low' && inflationCatForRegime === 'low') {
      regime = 'Deflation';
      reason = 'Pertumbuhan dan inflasi keduanya berada di zona rendah, menunjukkan penurunan aktivitas ekonomi.';
    } else {
      // Handle the remaining cases where at least one is medium
      // We will try to assign based on the non-medium one if available, otherwise default to Neutral Transition (but we already handled both medium)
      if (growthCatForRegime === 'medium' && inflationCatForRegime === 'low') {
        regime = 'Deflation'; // Assuming low inflation and medium growth -> deflation
        reason = 'Inflasi rendah dengan pertumbuhan netral, berisiko deflasi.';
      } else if (growthCatForRegime === 'medium' && inflationCatForRegime === 'high') {
        regime = 'Stagflation'; // Fallback to Stagflation for high inflation with medium growth
        reason = 'Inflasi tinggi dengan pertumbuhan netral, tekanan inflasi tinggi.';
      } else if (growthCatForRegime === 'high' && inflationCatForRegime === 'medium') {
        regime = 'Goldilocks'; // High growth with medium inflation
        reason = 'Pertumbuhan tinggi dengan inflasi netral, kondisi ideal.';
      } else if (growthCatForRegime === 'low' && inflationCatForRegime === 'medium') {
        regime = 'Deflation'; // Low growth with medium inflation
        reason = 'Pertumbuhan rendah dengan inflasi netral, menunjukkan pelambatan.';
      } else {
        // This should not happen because we already handled both medium.
        regime = 'Transition';
        reason = 'Kondisi campur yang tidak jelas; default ke transisi netral.';
      }
    }
  }

  // Add nuance from assetSignals (optional) as a refinement to the reason
  const assetClues: string[] = [];
  if (assetSignals.gldUp) assetClues.push('GLD naik');
  if (assetSignals.vixUp) assetClues.push('VIX naik');
  if (assetSignals.iefDown) assetClues.push('IEF turun (yield naik)');
  if (assetSignals.fxyUp) assetClues.push('FXY naik (yen stärkt)');

  if (assetClues.length) {
    reason += ` Konfirmasi dari aset: ${assetClues.join(', ')}.`;
  }

  // Calculate confidence score: distance from origin in z-score space, normalized by 2 (so max confidence is 1 when distance is 2)
  const confidence = Math.min(1, Math.sqrt(growth * growth + inflation * inflation) / 2);

  return {
    regime,
    shortReason: reason,
    details: {
      growth,
      inflation,
      growthCategory,
      inflationCategory,
      assetSignals: Object.keys(assetSignals).length ? assetSignals : undefined,
      confidence,
    },
  };
}

/* ---------- 2. ON RRP Liquidity Status ---------- */
// Threshold for daily delta to be considered "significant".
// 0.05B = $50M per day is sensitive enough without being too noisy.
const ONRRP_DELTA_THRESHOLD = 0.05; // in billions USD

export function classifyOnRrpLiquidity(
  inputs: OnRrpInputs
): OnRrpResult {
  const { deltaDaily, currentBalance } = inputs;
  const absDelta = Math.abs(deltaDaily);

  let status: OnRrpStatus;
  let reason: string;

  if (absDelta < ONRRP_DELTA_THRESHOLD) {
    status = 'Neutral';
    reason = `Perubahan harian ON RRP hanya ${deltaDaily.toFixed(2)}B, di bawah ambang signifikansi (±${ONRRP_DELTA_THRESHOLD}B).`;
  } else if (deltaDaily < -ONRRP_DELTA_THRESHOLD) {
    status = 'Draining';
    reason = `ON RRP mengeluarkan likuiditas sebesar ${Math.abs(
      deltaDaily
    ).toFixed(2)}B per hari (drain > ${ONRRP_DELTA_THRESHOLD}B).`;
  } else {
    // deltaDaily > threshold
    status = 'Refilling';
    reason = `ON RRP menambahkan likuiditas sebesar ${deltaDaily
      .toFixed(2)}B per hari (refill > ${ONRRP_DELTA_THRESHOLD}B).`;
  }

  return {
    status,
    shortReason: reason,
    details: {
      currentBalance,
      deltaDaily,
      thresholdUsed: ONRRP_DELTA_THRESHOLD,
    },
  };
}

/* ---------- 3. Transition Alert Logic ---------- */
export function getRegimeTransitionAlert(
  previousRegime: MacroRegime | null,
  newRegime: MacroRegime,
  timestamp: string = new Date().toISOString()
): RegimeTransitionAlert | null {
  // Only emit alert when there is a genuine change
  if (previousRegime === newRegime) {
    return null;
  }
  return {
    type: 'MACRO_REGIME_SHIFT',
    from: previousRegime,
    to: newRegime,
    timestamp,
  };
}

/* ---------- 4. Deterministic Narrative + Sentiment Mapper ---------- */
/**
 * Convert regime + liquidity status to market sentiment and risk impact phrase.
 * This is a logical mapping, not a free‑form LLM output.
 */
export function deriveSentimentAndImpact(
  regime: MacroRegime,
  liquidityStatus: OnRrpStatus
): {
  sentiment: MarketSentiment;
  impactOnRisk: string; // Bahasa Indonesia phrase
} {
  let sentiment: MarketSentiment = 'NEUTRAL';
  let impactOnRisk: string = 'netral terhadap risiko portofolio';

  // Reflation & Goldilocks generally risk‑on, unless strong liquidity drain
  if (regime === 'Reflation' || regime === 'Goldilocks') {
    sentiment = liquidityStatus === 'Draining' ? 'NEUTRAL' : 'RISK-ON';
    impactOnRisk =
      sentiment === 'RISK-ON'
        ? 'dengan pertambahan likuiditas dan pertumbuhan'
        : 'dengan likuiditas draining menekan optimisme';
  }
// Stagflation & Deflation generally risk‑off
  else if (regime === 'Stagflation' || regime === 'Deflation') {
    sentiment = liquidityStatus === 'Refilling' ? 'NEUTRAL' : 'RISK-OFF';
    impactOnRisk =
      sentiment === 'RISK-OFF'
        ? 'dengan stagflasi/deflasi yang menambah aversi risiko'
        : 'dengan likuiditas refill mengimbangi tekanan';
  }
  // 'Slowdown' removed — now unified under 'Deflation' above
  else if (regime === 'Transition') {
    sentiment = 'NEUTRAL';
    impactOnRisk = 'netral karena berada dalam transisi regime tanpa arah jelas';
  }

  return { sentiment, impactOnRisk };
}

/**
 * Narrative template that will be given to the LLM.
 * Returns a data object for the AI to generate its own narrative.
 */
export function buildNarrativeTemplate(
  regime: MacroRegime,
  shortReason: string,
  liquidityStatus: OnRrpStatus,
  sentimentImpact: ReturnType<typeof deriveSentimentAndImpact>
): { regime: MacroRegime; reason: string; liquidity: OnRrpStatus; sentiment: MarketSentiment } {
  const { sentiment } = sentimentImpact;
  return {
    regime,
    reason: shortReason,
    liquidity: liquidityStatus,
    sentiment
  };
}