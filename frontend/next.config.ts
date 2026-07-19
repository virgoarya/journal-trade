import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false, // Menghilangkan semua indikator pengembangan di frontend
  // Set turbopack root to frontend directory to avoid workspace warning
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  typescript: {
    ignoreBuildErrors: true, // Skip type checking during build for deployment
    // !! WARN !! !! WARN !! !! WARN !! !! WARN !! !! WARN !! !! WARN !!
    // !! Turning off type checking may cause serious bugs in production. !!
    // !! WARN !! !! WARN !! !! WARN !! !! WARN !! !! WARN !! !! WARN !!
  },
  async rewrites() {
    return [
      // Catch-all API proxy (handles Auth, V1, etc.)
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
