import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
    unoptimized: true, // This allows images to work without a specialized image server
  },
};

export default nextConfig;