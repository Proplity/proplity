import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/setup/globalSetup.ts'],
    setupFiles: ['tests/setup/loadEnv.ts'],
    include: ['tests/**/*.test.ts'],
    // The first request per route triggers Next dev's on-demand compile; real
    // Postgres round-trips add up further across a whole domain's RBAC matrix.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
