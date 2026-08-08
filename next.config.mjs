/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // The app was imported from a Figma/Vite export; don't block dev/build on lint.
    ignoreDuringBuilds: true,
  },
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
