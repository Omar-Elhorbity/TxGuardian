import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The SDK is consumed via workspace as raw TypeScript. Next's bundler
  // (webpack and Turbopack) needs to be told it's safe to transpile.
  transpilePackages: ["@txguardian/sdk"],
};

export default nextConfig;
