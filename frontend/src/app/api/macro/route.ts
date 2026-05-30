import { NextRequest, NextResponse } from 'next/server';
import type { MacroRawInputs } from '@/lib/macro/types';

const FRED_API_KEY = process.env.FRED_API_KEY;
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

// FRED series IDs
const SERIES_IDS = {
  // Growth
  UNRATE: 'UNRATE', // Unemployment Rate
  PAYEMS: 'PAYEMS', // Non-Farm Payrolls
  GDPC1: 'GDPC1', // Real GDP
  INDPRO: 'INDPRO', // Industrial Production

  // Inflation
  CPIAUCSL: 'CPIAUCSL', // CPI Headline
  PCEPILFE: 'PCEPILFE', // Core PCE
  T5YIE: 'T5YIE', // 5-Year Breakeven
  T10YIE: 'T10YIE', // 10-Year Breakeven
};

// Helper to fetch FRED data - returns empty array if API key not configured
async function fetchFredSeries(seriesId: string, startDate?: string): Promise<{ date: string; value: number }[]> {
  if (!FRED_API_KEY) {
    return []; // Return empty array to trigger fallback
  }

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: FRED_API_KEY,
    file_type: 'json',
    frequency: 'm', // Monthly data
    sort_order: 'asc',
    observation_start_date: startDate || getStartDate(48),
  });

  const response = await fetch(`${FRED_BASE_URL}?${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${seriesId}: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.observations) {
    return [];
  }

  // Filter out missing values ('.') and convert to number
  return data.observations
    .filter((obs: { date: string; value: string }) => obs.value !== '.')
    .map((obs: { date: string; value: string }) => ({
      date: obs.date,
      value: parseFloat(obs.value),
    }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
}

// Helper to get date 48 months ago in YYYY-MM-DD format
function getStartDate(monthsBack: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsBack);
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

// Helper to calculate MoM percent change
function calculateMoM(values: number[]): number[] {
  const mom: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const change = ((values[i] - values[i - 1]) / values[i - 1]) * 100;
    mom.push(change);
  }
  // Pad first month with 0 (no previous month to compare)
  return [0, ...mom];
}

// Helper to interpolate quarterly data to monthly
function interpolateQuarterlyToMonthly(quarterlyData: { date: string; value: number }[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < quarterlyData.length; i++) {
    // Each quarterly value is repeated for 3 months
    const value = quarterlyData[i].value;
    result.push(value, value, value);
  }
  return result;
}

// Helper to get last N months of data (to ensure we have 36-48 months)
function getLastNMonths(data: { date: string; value: number }[], n: number): number[] {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-n);
  return recent.map(d => d.value);
}

export async function GET(request: NextRequest) {
  try {
    // Fetch all series in parallel
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

    // Helper to generate dummy data when FRED data is not available
    const generateDummyData = (length: number = 48) => ({
      ismPmi: Array(length).fill(50),
      joblessClaims: Array(length).fill(200),
      unemployment: Array(length).fill(-4.0), // Inverted
      nfp: Array(length).fill(200),
      realGdp: Array(length).fill(2.0),
      corePce: Array(length).fill(2.5),
      supercore: Array(length).fill(2.5),
      cpiYoY: Array(length).fill(3.0),
      breakeven5y: Array(length).fill(2.0),
      breakeven10y: Array(length).fill(2.2),
    });

    // Check if any real data was fetched
    const hasRealData = unrateData.length > 0 && cpiData.length > 0;
    
    if (!hasRealData) {
      // Return dummy data when FRED API key is not configured
      const dummyInputs = generateDummyData();
      // Dummy CPI MoM data designed to show negative momentum (cooling)
      const dummyCpiMoM: number[] = [
        ...Array(34).fill(0.3),
        0.4, 0.4, 0.4, 0.3, 0.3, 0.3
      ];
      
      return NextResponse.json({
        success: true,
        data: dummyInputs,
        cpiMoM: dummyCpiMoM,
        isDummy: true,
      });
    }

    // Extract values (most recent 48 months)
    let unemployment = getLastNMonths(unrateData, 48);
    let nfp = getLastNMonths(payemsData, 48);
    let gdp = getLastNMonths(gdpData, 48);
    let industri = getLastNMonths(industriData, 48);
    let cpi = getLastNMonths(cpiData, 48);
    let corePce = getLastNMonths(corePceData, 48);
    let breakeven5y = getLastNMonths(breakeven5yData, 48);
    let breakeven10y = getLastNMonths(breakeven10yData, 48);

    // Handle GDP quarterly interpolation
    // If we have less than 48 months of GDP, it's because it's quarterly; interpolate
    const gdpQuarterly = gdpData.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
    const interpolatedGdp = interpolateQuarterlyToMonthly(gdpQuarterly.slice(-16)); // ~4 years of quarterly = ~48 months
    gdp = interpolatedGdp.slice(-48); // Take last 48 months

    // Handle Breakeven data (might have gaps) - pad with 0s or recent values
    while (breakeven5y.length < 48) {
      breakeven5y.unshift(breakeven5y[0] || 2.0);
    }
    while (breakeven10y.length < 48) {
      breakeven10y.unshift(breakeven10y[0] || 2.0);
    }

    // Invert unemployment (higher unemployment = worse growth)
    unemployment = unemployment.map(v => -v);

    // Calculate MoM for CPI
    const cpiMoM = calculateMoM(cpi);

    // Pad arrays to ensure they all have same length
    const targetLength = 48;
    const padToLength = (arr: number[]): number[] => {
      while (arr.length < targetLength) {
        arr.unshift(arr[0] || 0);
      }
      return arr;
    };

    const macroInputs: MacroRawInputs = {
      ismPmi: padToLength(Array(48).fill(50)), // FRED doesn't have ISM PMI, use placeholder
      joblessClaims: padToLength(Array(48).fill(200)), // FRED doesn't have Jobless Claims easily, use placeholder

      // Growth indicators
      unemployment,
      nfp,
      realGdp: gdp,
      industri, // Using INDPRO as a proxy

      // Inflation indicators
      corePce,
      supercore: corePce, // FRED doesn't have Supercore, use Core PCE as proxy
      cpiYoY: cpi, // Using CPI headline as proxy for YoY (should ideally calculate YoY)
      breakeven5y,
      breakeven10y,
    };

    return NextResponse.json({
      success: true,
      data: macroInputs,
      cpiMoM,
      isDummy: false,
    });
  } catch (error) {
    console.error('Error fetching FRED data:', error);
    // Return dummy data on error instead of failing
    const dummyInputs = {
      ismPmi: Array(48).fill(50),
      joblessClaims: Array(48).fill(200),
      unemployment: Array(48).fill(-4.0),
      nfp: Array(48).fill(200),
      realGdp: Array(48).fill(2.0),
      corePce: Array(48).fill(2.5),
      supercore: Array(48).fill(2.5),
      cpiYoY: Array(48).fill(3.0),
      breakeven5y: Array(48).fill(2.0),
      breakeven10y: Array(48).fill(2.2),
    };
    const dummyCpiMoM: number[] = [
      ...Array(34).fill(0.3),
      0.4, 0.4, 0.4, 0.3, 0.3, 0.3
    ];
    
    return NextResponse.json({
      success: true,
      data: dummyInputs,
      cpiMoM: dummyCpiMoM,
      isDummy: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}