import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = "http://localhost:5000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = `${BACKEND_URL}/api/${pathStr}?${request.url.split("?")[1] || ""}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        // Forward all headers except host
        ...Object.fromEntries(
          request.headers.entries()
            .filter(([key]) => key.toLowerCase() !== "host")
        ),
        // Forward cookies for authentication
        "Cookie": request.headers.get("Cookie") || "",
      },
      // Don't follow redirects automatically to preserve status codes
      redirect: "manual" as const,
    });

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error(`Proxy GET non-JSON response from ${url}:`, text.substring(0, 200));
      data = { success: false, error: "Backend returned non-JSON response", details: text.substring(0, 200) };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Proxy GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data from backend" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = `${BACKEND_URL}/api/${pathStr}`;

  try {
    const body = await request.json();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers.entries()
            .filter(([key]) => key.toLowerCase() !== "host")
        ),
        "Cookie": request.headers.get("Cookie") || "",
      },
      body: JSON.stringify(body),
      redirect: "manual" as const,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Proxy POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send data to backend" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = `${BACKEND_URL}/api/${pathStr}`;

  try {
    const body = await request.json();

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers.entries()
            .filter(([key]) => key.toLowerCase() !== "host")
        ),
        "Cookie": request.headers.get("Cookie") || "",
      },
      body: JSON.stringify(body),
      redirect: "manual" as const,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Proxy PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update data" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = `${BACKEND_URL}/api/${pathStr}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...Object.fromEntries(
          request.headers.entries()
            .filter(([key]) => key.toLowerCase() !== "host")
        ),
        "Cookie": request.headers.get("Cookie") || "",
      },
      redirect: "manual" as const,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Proxy DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete data" },
      { status: 500 }
    );
  }
}
