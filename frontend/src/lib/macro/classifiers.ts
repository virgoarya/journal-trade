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
    // Resolve states based on categories (high, low, medium)
    if (growthCategory === 'high' && inflationCategory === 'low') {
      regime = 'Goldilocks';
      reason = 'Pertumbuhan di atas tren dengan inflasi yang masih terkendali.';
    } else if (growthCategory === 'high' && inflationCategory === 'high') {
      regime = 'Reflation';
      reason = 'Pertumbuhan dan inflasi keduanya berakselerasi, biasanya didukung oleh ekspansi kredit dan komoditas.';
    } else if (growthCategory === 'low' && inflationCategory === 'high') {
      regime = 'Stagflation';
      reason = 'Pertumbuhan melambat sementara tekanan inflasi masih tinggi, sering akibat gangguan pasokan.';
    } else if (growthCategory === 'low' && inflationCategory === 'low') {
      regime = 'Deflation';
      reason = 'Pertumbuhan dan inflasi keduanya berada di zona rendah, menunjukkan penurunan aktivitas ekonomi.';
    } else if (growthCategory === 'medium' && inflationCategory === 'low') {
      regime = 'Deflation';
      reason = 'Inflasi rendah dengan pertumbuhan netral, berisiko deflasi.';
    } else if (growthCategory === 'medium' && inflationCategory === 'high') {
      regime = 'Stagflation';
      reason = 'Inflasi tinggi dengan pertumbuhan netral, tekanan inflasi tinggi.';
    } else if (growthCategory === 'high' && inflationCategory === 'medium') {
      regime = 'Goldilocks';
      reason = 'Pertumbuhan tinggi dengan inflasi netral, kondisi ideal.';
    } else if (growthCategory === 'low' && inflationCategory === 'medium') {
      regime = 'Deflation';
      reason = 'Pertumbuhan rendah dengan inflasi netral, menunjukkan pelambatan.';
    } else {
      regime = 'Transition';
      reason = 'Kondisi campur yang tidak jelas; default ke transisi netral.';
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