import 'server-only';
import { log } from './logger';

const logger = log('resilient-fetch');

/**
 * Runs a best-effort data fetch and returns a fallback instead of throwing.
 *
 * Used on public, non-critical sections (featured lists, filter sidebar
 * counts, catalog listings) where a database outage — or, during a first
 * deploy, a database that simply is not configured yet — should degrade to
 * an honest empty/unavailable state for that one section, rather than
 * taking down the whole page via the route's error boundary. The chrome
 * (header, hero, footer) stays visible either way.
 *
 * Not for anything transactional: checkout, auth, publishing and every other
 * mutation still let their error propagate, because pretending those
 * succeeded would be worse than showing the error screen.
 */
export async function resilient<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<{ data: T; unavailable: boolean }> {
  try {
    return { data: await fn(), unavailable: false };
  } catch (error) {
    logger.warn(
      { err: error, context },
      'data fetch failed, degrading to fallback'
    );
    return { data: fallback, unavailable: true };
  }
}
