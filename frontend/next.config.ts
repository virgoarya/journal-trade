import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // Menghilangkan semua indikator pengembangan di frontend
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  typescript: {
    ignoreBuildErrors: true, // Skip type checking during build for deployment
  },
  // Only use rewrites in development
  ...(process.env.NODE_ENV !== "production" && {
    async rewrites() {
      return [
        // Catch-all API proxy (handles Auth, V1, etc.)
        {
          source: "/api/:path*",
          destination: "http://localhost:5000/api/:path*",
        },
      ];
    },
  }),
};

export default nextConfig;
