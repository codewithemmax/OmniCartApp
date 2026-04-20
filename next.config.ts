import type { NextConfig } from "next";

const corsHeaders = [
  { key: "Access-Control-Allow-Credentials", value: "true" },
  { key: "Access-Control-Allow-Origin", value: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000" },
  { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: corsHeaders,
      },
    ];
  },
};

export default nextConfig;
