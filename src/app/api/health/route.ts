import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { isPaymentsConfigured } from '@/lib/env';
import { isStorageConfigured } from '@/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check for load balancers and uptime monitoring.
 *
 * Reports dependency status without leaking configuration detail: booleans
 * only, never hostnames, versions or credentials. Returns 503 when the
 * database is unreachable so an unhealthy instance is pulled from rotation.
 */
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const body = {
    status: database ? ('ok' as const) : ('degraded' as const),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database,
      payments: isPaymentsConfigured,
      storage: isStorageConfigured,
    },
    latencyMs: Date.now() - startedAt,
  };

  return NextResponse.json(body, {
    status: database ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
