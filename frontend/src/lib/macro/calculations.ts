// src/lib/macro/calculations.ts
/**
 * Pure functions for calculating macro scores from raw data
 */

import type { MacroRawInputs } from './types';
  }
  
  return result;
}

/**
 * Calculate inflation momentum adjustment
 * @param dataMoM - Array of month-over-month changes (in percent, oldest to newest)
 * @returns Momentum multiplier (negative when 3m AR < 6m AR indicating disinflationary momentum)
 */
export function calculateInflationMomentum(dataMoM: number[]): number {
  // Need at least 6 months of data
  if (dataMoM.length < 6) return 0;
  
  // Get last 3 and 6 months
  const recent3 = dataMoM.slice(-3);
  const recent6 = dataMoM.slice(-6);
  
  // Convert percent to decimal
  const toDecimal = (arr: number[]) => arr.map(x => x / 100);
  const dec3 = toDecimal(recent3);
  const dec6 = toDecimal(recent6);
  
  // Calculate 3-month annualized rate: (1+r1)(1+r2)(1+r3)^4 - 1
  const product3 = dec3.reduce((prod, r) => prod * (1 + r), 1);
  const ar3 = Math.pow(product3, 4) - 1;
  
  // Calculate 6-month annualized rate: (1+r1)...(1+r6)^2 - 1
  const product6 = dec6.reduce((prod, r) => prod * (1 + r), 1);
  const ar6 = Math.pow(product6, 2) - 1;
  
  // Return momentum adjustment (3m AR - 6m AR)
  return ar3 - ar6;
}

/**
 * Raw inputs for macro score aggregation
 */
export interface MacroRawInputs {
  // Growth indicators (higher = better for growth)
  ismPmi: number[];           // ISM PMI (leading)
  joblessClaims: number[];    // Jobless Claims (leading) - NOTE: should be inverted if raw data
  nfp: number[];              // Non-Farm Payrolls change (coincident)
  unemployment: number[];     // Unemployment rate (coincident) - NOTE: should be inverted if raw data
  realGdp: number[];          // Real GDP growth (lagging)
  
  // Inflation indicators (higher = higher inflation)
  corePce: number[];          // Core PCE (sticky/core)
  supercore: number[];        // Supercore (sticky/core)
  cpiYoY: number[];           // CPI YoY (headline)
  breakeven5y: number[];      // 5yr Breakeven Inflation (expectations)
  breakeven10y: number[];     // 10yr Breakeven Inflation (expectations)
}

/**
 * Aggregate raw indicator data into growth and inflation scores
 * @param inputs - Raw indicator data arrays (oldest to newest)
 * @returns Object containing growthScore and inflationScore (latest z-scores)
 */
export function aggregateMacroScores(inputs: MacroRawInputs): { growthScore: number; inflationScore: number } {
  // Helper to get latest z-score from an indicator series
  const getLatestZScore = (data: number[]): number => {
    const zScores = calculateRollingZScore(data, 36);
    return zScores[zScores.length - 1] || 0; // Return 0 if NaN or undefined
  };
  
  // Growth components (each 20% of 40% leading + 40% coincident + 20% lagging = 20% each)
  const growthScore = 
    0.2 * getLatestZScore(inputs.ismPmi) +
    0.2 * getLatestZScore(inputs.joblessClaims) +
    0.2 * getLatestZScore(inputs.nfp) +
    0.2 * getLatestZScore(inputs.unemployment) +
    0.2 * getLatestZScore(inputs.realGdp);
  
  // Inflation components
  // Sticky/Core: 50% split equally between Core PCE and Supercore (25% each)
  // Headline: 30% from CPI YoY
  // Expectations: 20% split equally between 5y and 10y Breakeven (10% each)
  const inflationScore = 
    0.25 * getLatestZScore(inputs.corePce) +
    0.25 * getLatestZScore(inputs.supercore) +
    0.30 * getLatestZScore(inputs.cpiYoY) +
    0.10 * getLatestZScore(inputs.breakeven5y) +
    0.10 * getLatestZScore(inputs.breakeven10y);
  
  return { growthScore, inflationScore };
}