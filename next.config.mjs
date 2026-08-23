/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16 enforces a single `next dev` server per distDir (a lockfile at
  // <distDir>/lock) -- so the automated test suite's spawned server sets
  // NEXT_TEST_DIST_DIR to run out of a separate build directory, letting it
  // coexist with a developer's already-running `pnpm dev` untouched.
  distDir: process.env.NEXT_TEST_DIST_DIR || '.next',
  // pg/@prisma/client are on Next's own default server-external-packages list,
  // but Turbopack (default bundler since Next 16) doesn't yet reliably honor
  // that default when the packages sit in pnpm's nested .pnpm store — declaring
  // them explicitly works around it. See vercel/next.js#68805.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  typescript: {
    // Don't block the build on pre-existing type quirks from the export.
    ignoreBuildErrors: true,
  },
  images: {
    // Property images are loaded from external URLs (e.g. Unsplash) via <img>.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
