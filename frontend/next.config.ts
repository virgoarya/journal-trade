import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: 'standalone', // Self-contained server for Electron desktop packaging
  devIndicators: false, // Menghilangkan semua indikator pengembangan di frontend
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  typescript: {
    ignoreBuildErrors: false, // Type checking aktif: error TS akan gagalkan build, mencegah bug runtime
  },
  async rewrites() {
    return [
      // Catch-all API proxy (handles Auth, V1, etc.)
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/:path*`,
      },
      // Special rewrite for open-desktop endpoint
      {
        source: "/api/v1/mt5/open-desktop",
        destination: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/v1/mt5/open-desktop`,
      },
    ];
  },
};

export default nextConfig;
