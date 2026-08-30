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
  // NOTE: `typescript.ignoreBuildErrors` was removed here deliberately --
  // `pnpm typecheck` passes clean on the whole tree, so the escape hatch was
  // only hiding future regressions from the production build. Don't re-add it;
  // fix the type error instead.
  // NOTE: do NOT add `outputFileTracingIncludes` for @prisma/client here.
  // A glob into pnpm's nested store matches sibling *directories* (e.g.
  // @prisma/client-runtime-utils) which Turbopack then tries to read as a
  // file and panics on. `serverExternalPackages` above already keeps Prisma
  // unbundled and traced correctly.
  images: {
    // Property images are loaded from external URLs (e.g. Unsplash) via <img>.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
