import 'server-only';
import { PrismaClient } from '@prisma/client';
import { isProduction } from '@/lib/env';

/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit until Postgres refuses connections. Caching on
 * globalThis keeps exactly one pool per process.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction
      ? [{ emit: 'event', level: 'error' }]
      : [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }],
  });

if (!isProduction) globalForPrisma.prisma = db;

export type { Prisma } from '@prisma/client';
export * from '@prisma/client';
