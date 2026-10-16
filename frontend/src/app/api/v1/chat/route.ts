import { NextRequest, NextResponse } from "next/server";

const EXPRESS_BACKEND = process.env.EXPRESS_BACKEND_URL || "http://localhost:5000";
const CHAT_ENDPOINT = `${EXPRESS_BACKEND}/api/v1/ai-coach/chat`;

/**
 * POST /api/v1/chat
 *
 * Next.js API route yang memproxy request ke Express backend
 * (server/src/routes/ai-coach.routes.ts → POST /api/v1/ai-coach/chat).
 *
 * Frontend (AiPersonaChatPanel) fetch ke /api/v1/chat,
 * route ini meneruskan ke Express dengan session cookie yang sama.
 */
export async function POST(request: NextRequest) {
  try {
    // Ambil cookie dari request browser
    const cookieHeader = request.headers.get("cookie") || "";

    // Build headers untuk Express
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Forward cookie sessions kalau ada
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    // Bypass auth di development mode (auth middleware punya bypass x-dev-user-id)
    if (process.env.NODE_ENV === "development") {
      headers["x-dev-user-id"] = "dev_user_hermes";
    }

    // Ambil body dari request
    const body = await request.json();

    // Forward ke Express backend
    const expressResponse = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      // timeout 30 detik
    });

    // Forward response dari Express ke frontend
    const contentType = expressResponse.headers.get("content-type") || "application/json";
    const responseBody = await expressResponse.text();

    return new NextResponse(responseBody, {
      status: expressResponse.status,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": request.headers.get("origin") || "*",
      },
    });
  } catch (error) {
    console.error("[API/v1/chat] Proxy error:", error);
    return NextResponse.json(
      { error: "Chat request failed", details: String(error) },
      { status: 500 }
    );
  }
}

// Handle CORS preflight kalau perlu
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": request.headers.get("origin") || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
    },
  });
}
