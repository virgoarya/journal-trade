import { NextResponse } from 'next/server';

const mockNews = [
  {
    id: 1,
    datetime: Math.floor(Date.now() / 1000) - 300,
    headline: "US Core PCE Price Index MoM Exceeds Expectations at 0.4%",
    summary: "Inflasi inti yang membandel memaksa The Fed menahan suku bunga lebih lama."
  },
  {
    id: 2,
    datetime: Math.floor(Date.now() / 1000) - 600,
    headline: "ECB President Lagarde Signals Summer Rate Cuts",
    summary: "Dovish divergence. ECB memotong suku bunga mendahului Fed."
  },
  {
    id: 3,
    datetime: Math.floor(Date.now() / 1000) - 900,
    headline: "Middle East Tensions Escalate: Supply Route Blocked",
    summary: "Lonjakan premi risiko geopolitik (Fear Trade). Emas bertindak sebagai safe haven."
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: mockNews
  });
}