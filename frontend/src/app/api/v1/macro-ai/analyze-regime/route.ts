import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: true,
    reasoning: "Analisis makro otomatis: pasar berada di fase Goldilocks dengan pertumbuhan stabil dan inflasi terkendali."
  });
}