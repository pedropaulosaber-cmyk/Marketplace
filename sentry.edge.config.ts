import * as Sentry from '@sentry/nextjs';

/**
 * Edge-runtime counterpart of `sentry.server.config.ts` — see that file for
 * the reasoning behind reading `process.env` directly and behind the
 * settings below. Middleware and any edge route load this one instead.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
