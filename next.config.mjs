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
    // Remote listing images are shown with plain <img>; the only next/image use is a
    // local file. A wildcard here made /_next/image an open proxy to any https host.
    remotePatterns: [],
  },
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      // Not a full script policy (the app relies on inline scripts); these three stop
      // framing, base-tag and form-target tricks and plugin content.
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
      },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ];
    return [{ source: '/:path*', headers: security }];
  },
};

export default nextConfig;
