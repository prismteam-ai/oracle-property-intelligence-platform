import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg", "postgres", "@neondatabase/serverless"],
};

export default nextConfig;
