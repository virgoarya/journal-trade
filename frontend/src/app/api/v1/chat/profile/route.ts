import { NextRequest, NextResponse } from "next/server";

const EXPRESS_BACKEND = process.env.EXPRESS_BACKEND_URL || "http://localhost:5000";

/**
 * GET /api/v1/chat/profile
 *
 * Proxy ke Express backend `GET /api/v1/chat/profile` — mengembalikan
 * profil user (preferredName, persona) + jumlah memory facts untuk badge UI.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const headers: Record<string, string> = {};

    if (cookieHeader) headers.Cookie = cookieHeader;
    if (process.env.NODE_ENV === "development") {
      headers["x-dev-user-id"] = "dev_user_hermes";
    }

    const expressResponse = await fetch(`${EXPRESS_BACKEND}/api/v1/chat/profile`, {
      method: "GET",
      headers,
    });

    const responseBody = await expressResponse.text();

    return new NextResponse(responseBody, {
      status: expressResponse.status,
      headers: {
        "Content-Type": expressResponse.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[API/v1/chat/profile] Proxy error:", error);
    return NextResponse.json(
      { success: false, error: "Profile request failed" },
      { status: 500 }
    );
  }
}
