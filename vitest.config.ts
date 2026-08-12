import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Integration tests share one Postgres schema, so they must not run
    // concurrently against each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // `server-only` exists to fail a *bundler* build when server code is
      // pulled into a client bundle. Vitest resolves its browser entry, which
      // throws on import. Tests run in Node, where the guard has nothing to
      // protect, so it is stubbed out. The real protection still applies to
      // `next build`, which is where it matters.
      'server-only': resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
