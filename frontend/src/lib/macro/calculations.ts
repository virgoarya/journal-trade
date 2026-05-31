// src/lib/macro/calculations.ts
/**
 * Pure functions for calculating macro scores from raw data
 */

import type { MacroRawInputs } from './types';

/**
 * Calculate rolling z-score using a specified window size
 * @param data - Array of numerical values (oldest to newest)
 * @param windowSize - Window size in periods (default: 36 for 3 years)
 * @returns Array of z-scores (same length as input, with NaN for insufficient data)
 */
export function calculateRollingZScore(data: number[], windowSize: number = 36): number[] {
  if (data.length === 0) return [];
  
  const result: number[] = new Array(data.length).fill(NaN);
  
  // Need at least windowSize points to calculate
  if (data.length < windowSize) return result;
  
  for (let i = windowSize - 1; i < data.length; i++) {
    const window = data.slice(i - windowSize + 1, i + 1);
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    
    // Calculate variance
    const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);
    
    // Avoid division by zero
    if (stdDev === 0) {
      result[i] = 0;
    } else {
      result[i] = (data[i] - mean) / stdDev;
    }
  }
  
  return result;
}

/**
 * Calculate inflation momentum adjustment
 * @param dataMoM - Array of month-over-month changes (in percent, oldest to newest)
 * @returns Momentum multiplier (negative when 3m AR < 6m AR indicating disinflationary momentum)
 */
export function calculateInflationMomentum(dataMoM: number[]): number {
  if (!Array.isArray(dataMoM) || dataMoM.length < 6) return 0;
  
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