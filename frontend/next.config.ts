import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Phaser ships ESM with browser globals — keep it client-side only.
  transpilePackages: ["phaser"],
};

export default nextConfig;
