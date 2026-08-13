import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `captureError` has to be safe to call unconditionally from every catch
 * block in the app. Unconfigured — the default in every other test in this
 * suite — it must never touch the SDK at all; configured, it must actually
 * report; and either way it must never throw, since a monitoring failure
 * must not become a second, unrelated failure on top of the one reported.
 */
describe('captureError', () => {
  const originalDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    vi.doUnmock('@sentry/nextjs');
    vi.resetModules();
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
  });

  it('never imports the SDK when no DSN is configured', async () => {
    delete process.env.SENTRY_DSN;
    vi.resetModules();

    const captureException = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({ captureException }));

    const { captureError } = await import('@/lib/monitoring');
    captureError(new Error('boom'));

    // Give any stray microtask a chance to run before asserting silence —
    // the point of the no-op path is that the SDK is never touched at all.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports through the SDK once a DSN is configured', async () => {
    process.env.SENTRY_DSN = 'https://key@o0.ingest.sentry.io/1';
    vi.resetModules();

    const captureException = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({ captureException }));

    const { captureError } = await import('@/lib/monitoring');
    const error = new Error('boom');
    captureError(error, { orderId: 'ord_1' });

    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));
    expect(captureException).toHaveBeenCalledWith(error, {
      extra: { orderId: 'ord_1' },
    });
  });

  it('never throws even if the SDK itself fails', async () => {
    process.env.SENTRY_DSN = 'https://key@o0.ingest.sentry.io/1';
    vi.resetModules();

    vi.doMock('@sentry/nextjs', () => ({
      captureException: () => {
        throw new Error('sentry itself is down');
      },
    }));

    const { captureError } = await import('@/lib/monitoring');
    expect(() => captureError('not an Error instance')).not.toThrow();
  });
});
