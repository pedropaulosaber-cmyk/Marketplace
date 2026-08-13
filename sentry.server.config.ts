import * as Sentry from '@sentry/nextjs';

/**
 * Node-runtime error reporting. Loaded once by `src/instrumentation.ts` —
 * never imported directly — which is what guarantees it runs before any
 * request handler.
 *
 * The DSN is read straight from `process.env` rather than the validated
 * `env` module: `@/lib/env` pulls in `node:crypto` for its session-secret
 * fallback, which is harmless here but would break the edge counterpart of
 * this file, so both configs are kept symmetric and dependency-free instead
 * (the same reason `src/middleware.ts` reads `process.env.APP_URL` directly
 * rather than importing `env`).
 *
 * Absent DSN means no `init()` call at all, not an init pointed at an empty
 * string — the SDK stays completely inert, the same shape payments and
 * storage take without their own credentials.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Error events only. Performance tracing is a separate cost/sampling
    // decision, not turned on by default here.
    tracesSampleRate: 0,

    // No source maps are uploaded — that needs SENTRY_AUTH_TOKEN plus an
    // org/project at build time, a build-time dependency this project does
    // not take on by default. Stack traces still work, just against built
    // output rather than original source.
  });
}
