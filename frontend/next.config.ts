import type { NextConfig } from "next";

// NEXT_EXPORT=1 builds the static bundle shipped inside the mobile app's
// WebView (app/assets/web.zip). The Vercel deployment keeps the default
// server output.
const isExport = process.env.NEXT_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Phaser ships ESM with browser globals; keep Turbopack from choking on it.
  transpilePackages: ["phaser"],
  ...(isExport
    ? {
        output: "export" as const,
        // /play → out/play/index.html so a plain static file server
        // (shelf_static in the app) can resolve directory routes.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
