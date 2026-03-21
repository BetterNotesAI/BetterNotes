import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
}

export default nextConfig
