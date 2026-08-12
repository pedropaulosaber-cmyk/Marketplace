import { vi } from 'vitest';
import type * as ReactModule from 'react';

/**
 * Test environment setup.
 *
 * Services under test are real — no repository or Prisma mocking. What is
 * stubbed is only the Next.js request context (`cookies()`, `headers()`),
 * which does not exist outside a server request. Everything else, including
 * authorization, hashing and database constraints, runs for real so the tests
 * actually exercise the behaviour they claim to.
 */

// `NODE_ENV` is typed read-only, so the whole block is assigned at once.
// Defaults only: an explicitly exported value always wins, which is what lets
// CI point these tests at its own database.
Object.assign(process.env, {
  NODE_ENV: process.env.NODE_ENV ?? 'test',
  SESSION_SECRET:
    process.env.SESSION_SECRET ??
    'test-session-secret-value-at-least-32-chars-long',
  APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://automatize:automatize@localhost:5432/automatize_test?schema=public',
  // Exercise the driver production actually runs. Set explicitly because
  // Prisma loads `.env` on import, and a developer's local `.env` selecting
  // the in-memory driver would otherwise silently decide what these tests
  // cover — the shared-counter behaviour would go untested on exactly the
  // machines most likely to change it.
  RATE_LIMIT_DRIVER: process.env.RATE_LIMIT_DRIVER ?? 'database',
});

/** Mutable cookie jar, reset between tests by the auth helpers. */
export const testCookies = new Map<string, string>();

/** Request headers the code under test reads (IP, user agent). */
export const testHeaders = new Map<string, string>([
  ['user-agent', 'vitest'],
  ['x-forwarded-for', '203.0.113.10'],
]);

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = testCookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      testCookies.set(name, value);
    },
    delete: (name: string) => {
      testCookies.delete(name);
    },
    has: (name: string) => testCookies.has(name),
  }),
  headers: async () => ({
    get: (name: string) => testHeaders.get(name.toLowerCase()) ?? null,
  }),
}));

/**
 * `react.cache` memoises per-render in a real server. In tests there is no
 * render pass, so it must be a pass-through — otherwise a session lookup from
 * one test would be served to the next.
 */
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  };
});
