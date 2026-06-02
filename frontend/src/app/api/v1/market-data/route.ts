import { NextResponse } from 'next/server';

const mockAssets = [
  { ticker: "SPY", name: "S&P 500 (Equities)", change: 0.5 },
  { ticker: "QQQ", name: "Nasdaq (Tech)", change: 0.8 },
  { ticker: "GLD", name: "Gold (Safe Haven)", change: -0.2 },
  { ticker: "VIXY", name: "VIX (Volatility)", change: 0.1 },
  { ticker: "IEF", name: "US 10Y (Bonds)", change: -0.1 },
  { ticker: "UUP", name: "US Dollar (DXY)", change: 0.2 },
  { ticker: "FXY", name: "Japanese Yen", change: -0.1 },
  { ticker: "TIP", name: "TIPS (Real Yield)", change: 0.3 },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: mockAssets.map(asset => ({
      symbol: asset.ticker,
      data: { dp: asset.change }
    }))
  });
}