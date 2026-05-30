import { NextRequest, NextResponse } from 'next/server';
import type { MacroRawInputs } from '@/lib/macro/types';
import { aggregateMacroScores } from '@/lib/macro/calculations';
import { classifyMacroRegime } from '@/lib/macro/classifiers';

const FRED_API_KEY = process.env.FRED_API_KEY;
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

const SERIES_IDS = {
  // Growth
  UNRATE: 'UNRATE',
  PAYEMS: 'PAYEMS',
  GDPC1: 'GDPC1',
  INDPRO: 'INDPRO',
  // Inflation
  CPIAUCSL: 'CPIAUCSL',
  PCEPILFE: 'PCEPILFE',
  T5YIE: 'T5YIE',
  T10YIE: 'T10YIE',
};

function getStartDate(monthsBack: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsBack);
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

async function fetchFredSeries(seriesId: string, startDate?: string): Promise<{ date: string; value: number }[]> {
  if (!FRED_API_KEY) {
    console.error(`[FRED] API key not configured for series ${seriesId}`);
    return [];
  }

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: FRED_API_KEY,
    file_type: 'json',
    frequency: 'm',
    sort_order: 'asc',
    observation_start_date: startDate || getStartDate(48),
  });

  const response = await fetch(`${FRED_BASE_URL}?${params}`);
  
  if (!response.ok) {
    console.error(`[FRED] Failed to fetch ${seriesId}: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = await response.json();
  
  if (!data.observations) {
    console.error(`[FRED] No observations returned for ${seriesId}`);
    return [];
  }

  // Filter out missing values and do forward-fill for gaps
  const rawValues = data.observations
    .map((obs: { date: string; value: string }) => ({
      date: obs.date,
      value: obs.value,
    }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));

  // Forward-fill: replace '.' with previous valid value
  const filledValues: { date: string; value: number }[] = [];
  let lastValidValue: number | null = null;
  
  for (const obs of rawValues) {
    if (obs.value !== '.') {
      lastValidValue = parseFloat(obs.value);
    }
    // Only include if we have a valid value (either current or forward-filled)
    if (lastValidValue !== null) {
      filledValues.push({
        date: obs.date,
        value: lastValidValue,
      });
    }
  }

  return filledValues;
}

function calculateMoM(values: number[]): number[] {
  const mom: number[] = [0]; // First month has no previous
  for (let i = 1; i < values.length; i++) {
    const change = ((values[i] - values[i - 1]) / values[i - 1]) * 100;
    mom.push(Math.round(change * 100) / 100); // Round to 2 decimal places
  }
  return mom;
}

function interpolateQuarterlyToMonthly(quarterlyData: { date: string; value: number }[]): number[] {
  const result: number[] = [];
  for (const item of quarterlyData) {
    result.push(item.value, item.value, item.value); // Repeat each quarter 3 times
  }
  return result;
}

function syncArrayLengths(...arrays: number[][]): number[] {
  const minLen = Math.min(...arrays.map(a => a.length));
  return arrays.map(a => a.slice(-minLen));
}

function generateDummyData(length: number = 48): MacroRawInputs {
  return {
    ismPmi: Array(length).fill(50),
    joblessClaims: Array(length).fill(200),
    unemployment: Array(length).fill(-4.0),
    nfp: Array(length).fill(200),
    realGdp: Array(length).fill(2.0),
    corePce: Array(length).fill(2.5),
    supercore: Array(length).fill(2.5),
    cpiYoY: Array(length).fill(3.0),
    breakeven5y: Array(length).fill(2.0),
    breakeven10y: Array(length).fill(2.2),
  };
}

export async function GET(request: NextRequest) {
  try {
    const [
      unrateData,
      payemsData,
      gdpData,
      industriData,
      cpiData,
      corePceData,
      breakeven5yData,
      breakeven10yData,
    ] = await Promise.all([
      fetchFredSeries(SERIES_IDS.UNRATE),
      fetchFredSeries(SERIES_IDS.PAYEMS),
      fetchFredSeries(SERIES_IDS.GDPC1),
      fetchFredSeries(SERIES_IDS.INDPRO),
      fetchFredSeries(SERIES_IDS.CPIAUCSL),
      fetchFredSeries(SERIES_IDS.PCEPILFE),
      fetchFredSeries(SERIES_IDS.T5YIE),
      fetchFredSeries(SERIES_IDS.T10YIE),
    ]);

    // Generate dummy fallback data
    const generateDummyData = (length: number = 48): MacroRawInputs => ({
      ismPmi: Array(length).fill(50),
      joblessClaims: Array(length).fill(200),
      unemployment: Array(length).fill(-4.0),
      nfp: Array(length).fill(200),
      realGdp: Array(length).fill(2.0),
      corePce: Array(length).fill(2.5),
      supercore: Array(length).fill(2.5),
      cpiYoY: Array(length).fill(3.0),
      breakeven5y: Array(length).fill(2.0),
      breakeven10y: Array(length).fill(2.2),
    });

    // Check if we have meaningful real data
    const hasRealData = unrateData.length >= 36 && cpiData.length >= 36;
    
    if (!hasRealData) {
      console.log(`[FRED] Insufficient data, using dummy fallback. unrate:${unrateData.length}, cpi:${cpiData.length}`);
      const dummyInputs = generateDummyData();
      const dummyCpiMoM: number[] = [
        ...Array(34).fill(0.3),
        0.4, 0.4, 0.4, 0.3, 0.3, 0.3
      ];

      // Calculate regime for dummy data
      const { growthScore, inflationScore } = aggregateMacroScores(dummyInputs);
      const regimeResult = classifyMacroRegime({
        growth: growthScore,
        inflation: inflationScore,
        assetSignals: {},
      });
      
      return NextResponse.json({
        success: true,
        data: dummyInputs,
        cpiMoM: dummyCpiMoM,
        isDummy: true,
        regime: regimeResult.regime,
      });
    }

    // Extract values
    let unemployment = unrateData.map(d => -d.value); // Inverted
    let nfp = payemsData.map(d => d.value);
    let cpi = cpiData.map(d => d.value);
    let corePce = corePceData.map(d => d.value);
    let industri = industriData.map(d => d.value);
    let breakeven5y = breakeven5yData.map(d => d.value);
    let breakeven10y = breakeven10yData.map(d => d.value);

    // Handle GDP quarterly interpolation
    const interpolatedGdp = interpolateQuarterlyToMonthly(gdpData.slice(-16));
    
    // Sync all array lengths to minimum
    const synced = syncArrayLengths(
      unemployment,
      nfp,
      interpolatedGdp,
      industri,
      cpi,
      corePce,
      breakeven5y,
      breakeven10y
    );
    
    [unemployment, nfp, corePce, industri, cpi, breakeven5y, breakeven10y] = synced;

    // Calculate MoM for CPI
    const cpiMoM = calculateMoM(cpi);

    // Pad to target length if needed
    const targetLength = 48;
    const padToLength = (arr: number[], fillValue: number): number[] => {
      while (arr.length < targetLength) {
        arr.unshift(fillValue);
      }
      return arr.slice(-targetLength);
    };

    const macroInputs: MacroRawInputs = {
      ismPmi: padToLength(Array(48).fill(50), 50),
      joblessClaims: padToLength(Array(48).fill(200), 200),
      unemployment,
      nfp,
      realGdp: padToLength(interpolatedGdp, 2.0),
      corePce,
      supercore: corePce,
      cpiYoY: padToLength(cpi, 3.0),
      breakeven5y: padToLength(breakeven5y, 2.0),
      breakeven10y: padToLength(breakeven10y, 2.2),
    };

    // Calculate regime from the aggregated scores
    const { growthScore, inflationScore } = aggregateMacroScores(macroInputs);
    const regimeResult = classifyMacroRegime({
      growth: growthScore,
      inflation: inflationScore,
      assetSignals: {},
    });
    const detectedRegime = regimeResult.regime;

    return NextResponse.json({
      success: true,
      data: macroInputs,
      cpiMoM,
      isDummy: false,
      regime: detectedRegime,
    });
  } catch (error: any) {
    console.error('[FRED] Unexpected error in macro API route:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    const generateDummyData = (length: number = 48): MacroRawInputs => ({
      ismPmi: Array(length).fill(50),
      joblessClaims: Array(length).fill(200),
      unemployment: Array(length).fill(-4.0),
      nfp: Array(length).fill(200),
      realGdp: Array(length).fill(2.0),
      corePce: Array(length).fill(2.5),
      supercore: Array(length).fill(2.5),
      cpiYoY: Array(length).fill(3.0),
      breakeven5y: Array(length).fill(2.0),
      breakeven10y: Array(length).fill(2.2),
    });

    const dummyInputs = generateDummyData();
    const dummyCpiMoM: number[] = [
      ...Array(34).fill(0.3),
      0.4, 0.4, 0.4, 0.3, 0.3, 0.3
    ];

    // Calculate regime for dummy data
    const { growthScore, inflationScore } = aggregateMacroScores(dummyInputs);
    const regimeResult = classifyMacroRegime({
      growth: growthScore,
      inflation: inflationScore,
      assetSignals: {},
    });

    return NextResponse.json({
      success: true,
      data: dummyInputs,
      cpiMoM: dummyCpiMoM,
      isDummy: true,
      regime: regimeResult.regime,
      error: error.message || 'Unknown error',
    });
  }
}