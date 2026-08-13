/**
 * Next.js instrumentation hook — runs once per runtime, before any request
 * handler in it. Its only job is loading the Sentry config that matches the
 * current runtime, so error reporting is live before anything else can fail.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
