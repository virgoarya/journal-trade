import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: true,
    analysis: JSON.stringify({
      fakta: "Data berita telah diproses oleh sistem.",
      dampakMarket: "Aset terkait mengalami volatilitas tinggi.",
      logika: "Analisis teknikal dan fundamental menguat.",
      contrarian: "Sudut pandang contrarian: perhatikan risk reversal.",
      triggerFundamentalNonTeknikal: "Geopolitik dan kebijakan moneter.",
      confidenceScore: "Tinggi"
    })
  });
}