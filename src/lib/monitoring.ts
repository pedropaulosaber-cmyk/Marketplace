import 'server-only';
import { isMonitoringConfigured } from './env';

/**
 * Reports an unexpected error to Sentry.
 *
 * A no-op when no DSN is configured — including never importing the SDK,
 * not just skipping the call — so this can be called unconditionally from
 * every catch block in the app with zero cold-start or test-suite cost when
 * monitoring is off. Fire-and-forget on purpose: reporting must never add
 * latency to, or itself become a second failure on top of, the error it is
 * reporting.
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!isMonitoringConfigured) return;

  import('@sentry/nextjs')
    .then((Sentry) =>
      Sentry.captureException(error, context ? { extra: context } : undefined)
    )
    .catch(() => {
      // Best-effort only — see above.
    });
}
