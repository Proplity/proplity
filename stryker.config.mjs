// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.unit.config.mts',
    related: false,
  },
  coverageAnalysis: 'off',
  ignorePatterns: [
    '.next/**',
    '.next-test/**',
    'coverage/**',
    'dist/**',
    'node_modules/**',
    '.git/**',
    '.vercel/**',
    'playwright-report/**',
    'test-results/**',
    'public/**',
    'docs/**',
    'prisma/**',
    '.stryker-tmp/**',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  mutate: [
    'lib/propertyFingerprint.ts',
    'lib/fileRef.ts',
    'lib/uploadPolicy.ts',
    'lib/appUrl.ts',
    'lib/auth/jwt.ts',
  ],
  thresholds: { high: 85, low: 70, break: null },
  concurrency: 4,
  timeoutMS: 10000,
};

export default config;
