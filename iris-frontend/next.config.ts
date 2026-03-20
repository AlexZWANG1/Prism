import type { NextConfig } from "next";

const backendBaseUrl = (process.env.NEXT_BACKEND_URL || "http://localhost:8000")
  .trim()
  .replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
