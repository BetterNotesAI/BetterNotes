import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
}

export default nextConfig
