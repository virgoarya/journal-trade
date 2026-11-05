import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: 'standalone', // Self-contained server for Electron desktop packaging
  outputFileTracingRoot: process.cwd(),
  devIndicators: false, // Menghilangkan semua indikator pengembangan di frontend
  allowedDevOrigins: ["192.168.100.3"], // Allow gadget to access dev server (HMR/assets)
  typescript: {
    ignoreBuildErrors: true, // Ignored during build for packaging
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'devlop': path.resolve(process.cwd(), 'node_modules/devlop/lib/default.js'),
    };
    return config;
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
