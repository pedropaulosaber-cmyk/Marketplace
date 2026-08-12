import 'server-only';
import { PrismaClient } from '@prisma/client';
import { env, isProduction } from '@/lib/env';

/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit until Postgres refuses connections. Caching on
 * globalThis keeps exactly one pool per process.
 *
 * `datasourceUrl` is passed explicitly rather than left to Prisma's own
 * `env("DATABASE_URL")` lookup in schema.prisma, which reads `process.env`
 * directly and throws the instant it's missing — before `env.ts`'s fallback
 * ever gets a chance to apply. Passing it here means the *only* place that
 * decides what DATABASE_URL is falls back gracefully.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
    log: isProduction
      ? [{ emit: 'event', level: 'error' }]
      : [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }],
  });

if (!isProduction) globalForPrisma.prisma = db;

export type { Prisma } from '@prisma/client';
export * from '@prisma/client';
