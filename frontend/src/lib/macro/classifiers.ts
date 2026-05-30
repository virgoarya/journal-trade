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
// Thresholds can be tuned; values below are illustrative.
// Growth: > 0.2%/month considered high, <= 0.2% low
// Inflation: > 3%/year considered high, <= 3% low
const GROWTH_THRESHOLD = 0.2; // percent per month
const INFLATION_THRESHOLD = 3.0; // percent per year

export function classifyMacroRegime(
  inputs: MacroInputs
): MacroRegimeResult {
  const { growth, inflation, assetSignals = {} } = inputs;

  const growthCat = growth > GROWTH_THRESHOLD ? 'high' : 'low';
  const inflationCat = inflation > INFLATION_THRESHOLD ? 'high' : 'low';

  // Priority logic (classic 4‑quadrant)
  let regime: MacroRegime;
  let reason: string;

  if (growthCat === 'high' && inflationCat === 'low') {
    regime = 'Goldilocks';
    reason = 'Pertumbuhan di atas tren dengan inflasi yang masih terkendali.';
  } else if (growthCat === 'high' && inflationCat === 'high') {
    regime = 'Reflation';
    reason = 'Pertumbuhan dan inflasi keduanya berakselerasi, biasanya didukung oleh ekspansi kredit dan komoditas.';
  } else if (growthCat === 'low' && inflationCat === 'high') {
    regime = 'Stagflation';
    reason = 'Pertumbuhan melambat sementara tekanan inflasi masih tinggi, sering akibat gangguan pasokan.';
  } else if (growthCat === 'low' && inflationCat === 'low') {
    regime = 'Deflation';
    reason = 'Kedua pertumbuhan dan inflasi berada di zona rendah, berisiko spiral deflasi.';
  } else {
    // Fallback should never happen because all cases are covered above
    regime = 'Inflation'; // placeholder
    reason = 'Kondisi tidak jelas; default ke Inflation.';
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

  return {
    regime,
    shortReason: reason,
    details: {
      growth,
      inflation,
      growthCategory: growthCat,
      inflationCategory: inflationCat,
      assetSignals: Object.keys(assetSignals).length ? assetSignals : undefined,
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
        ? 'cenderung mendukung risiko‑on (pertambahan likuiditas dan pertumbuhan)'
        : 'netral karena likuiditas draining menekan optimisme';
  }
  // Stagflation & Deflation generally risk‑off
  else if (regime === 'Stagflation' || regime === 'Deflation') {
    sentiment = liquidityStatus === 'Refilling' ? 'NEUTRAL' : 'RISK-OFF';
    impactOnRisk =
      sentiment === 'RISK-OFF'
        ? 'cenderung risiko‑off karena stagflasi/deflasi menambah aversi risiko'
        : 'netral karena likuiditas refill mengimbangi tekanan';
  }
  // Inflation‑only (low growth, high inflation) tends risk‑off
  else if (regime === 'Inflation') {
    sentiment = liquidityStatus === 'Refilling' ? 'NEUTRAL' : 'RISK-OFF';
    impactOnRisk =
      sentiment === 'RISK-OFF'
        ? 'tekanan inflasi tinggi mendorong aversi risiko, kecuali likuiditas refill cukup besar'
        : 'netral karena likuiditas refill mengimbangi tekanan inflasi';
  }

  return { sentiment, impactOnRisk };
}

/**
 * Narrative template that will be given to the LLM.
 * The LLM only needs to fill in {{shortReason}} (1‑2 sentences) based on the structured inputs.
 * All other variables will be replaced by this code.
 */
export function buildNarrativeTemplate(
  regime: MacroRegime,
  shortReason: string,
  liquidityStatus: OnRrpStatus,
  sentimentImpact: ReturnType<typeof deriveSentimentAndImpact>
): string {
  const { sentiment, impactOnRisk } = sentimentImpact;
  return `Kondisi regime makro saat ini terdeteksi sebagai ${regime} karena ${shortReason}.
 Likuiditas ON RRP saat ini berstatus ${liquidityStatus}, yang cenderung ${impactOnRisk}.
 INSTITUTIONAL SENTIMENT STATUS: ${sentiment}.`;
}