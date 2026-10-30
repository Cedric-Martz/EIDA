import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // A production export rewrites `.next`. Keeping development artifacts in a
  // separate directory prevents a concurrent build from invalidating chunks
  // already referenced by an open development page.
  distDir: isDevelopment ? ".next-dev" : ".next",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
