import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The SDK is consumed via workspace as raw TypeScript. Next.js bundler
  // needs to be told it's safe to transpile.
  transpilePackages: ["@txguardian/sdk"],
  experimental: {
    // Server actions not used; keep defaults conservative.
  },
};

export default nextConfig;
