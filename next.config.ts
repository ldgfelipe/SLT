import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
    // Disable component caching for dynamic routes
    cacheComponents: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
