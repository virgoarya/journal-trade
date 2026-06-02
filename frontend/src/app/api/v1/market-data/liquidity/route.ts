import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      value: 2.8,
      change: 0.1,
      status: "INJECTING" as const,
      date: new Date().toISOString(),
      trend: ["injecting", "injecting"]
    }
  });
}