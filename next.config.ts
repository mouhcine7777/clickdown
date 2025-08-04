import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Disables ESLint during builds
  },
  images: {
    unoptimized: true, 
  },
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;