import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // Menghilangkan semua indikator pengembangan di frontend
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Force webpack instead of turbopack for production builds to avoid Docker issues
    turbopack: false,
  },
  typescript: {
    ignoreBuildErrors: true, // Skip type checking during build for deployment
    // !! WARN !! !! WARN !! !! WARN !! !! WARN !! !! WARN !! !! WARN !!
    // !! Turning off type checking may cause serious bugs in production. !!
    // !! WARN !! !! WARN !! !! WARN !! !! WARN !! !! WARN !! !! WARN !!
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
