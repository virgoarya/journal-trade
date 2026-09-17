import type { NextRequest } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export async function GET(req: NextRequest) {
  const pathSegments = req.nextUrl.pathname.split("/").filter(Boolean);
  // Expected path: /api/agent-consensus/<rest>
  // Backend path: /api/<rest>
  const backendPath = pathSegments.slice(1).join("/"); // Exclude '/api/' prefix
  const finalBackendUrl = `${BACKEND_URL}/${backendPath}`;

  console.log(`[Proxy GET] ${req.nextUrl.pathname} -> ${finalBackendUrl}`);
  return proxyRequest(req, finalBackendUrl);
}

export async function POST(req: NextRequest) {
  const pathSegments = req.nextUrl.pathname.split("/").filter(Boolean);
  // Expected path: /api/agent-consensus/<rest>
  // Backend path: /api/<rest>
  const backendPath = pathSegments.slice(1).join("/"); // Exclude '/api/' prefix
  const finalBackendUrl = `${BACKEND_URL}/${backendPath}`;

  console.log(`[Proxy POST] ${req.nextUrl.pathname} -> ${finalBackendUrl}`);
  return proxyRequest(req, finalBackendUrl);
}

async function proxyRequest(req: NextRequest, url: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (req.headers.get("authorization")) {
    headers["Authorization"] = req.headers.get("authorization") || "";
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method === "POST") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({ error: "Backend returned invalid JSON" }));
    console.log(`[Proxy Response] ${res.status}`, JSON.stringify(data).slice(0, 500));
    return Response.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Proxy Fetch Error]", error.message);
    return Response.json({ error: "Proxy fetch error: " + error.message }, { status: 500 });
  }
}