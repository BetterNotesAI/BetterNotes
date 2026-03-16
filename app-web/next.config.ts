import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },

  // Prevent ESLint warnings from failing the production build.
  // Lint issues are still flagged locally but don't block deployment.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Phase 2: Legacy redirect — old /workspace bookmarks → /projects
  // The workspace page still exists and works, this only catches
  // users who had /workspace bookmarked as their "project list".
  // /workspace?chat=xxx still works (handled by the workspace page itself).
  async redirects() {
    return [];
  },
};

export default nextConfig;