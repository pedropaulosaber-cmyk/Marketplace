import 'server-only';
import { z } from 'zod';

/**
 * Server-side environment configuration.
 *
 * Parsed once, at module load. An invalid configuration throws immediately so
 * a misconfigured deploy fails at boot instead of leaking a half-working app
 * (e.g. a checkout that silently runs without a webhook secret).
 *
 * This module is `server-only`: importing it from a Client Component is a
 * build error, which keeps secrets out of the browser bundle by construction.
 */

const nonEmpty = (name: string) =>
  z.string().min(1, `${name} must not be empty`);

const urlNoTrailingSlash = z
  .string()
  .url()
  .refine((v) => !v.endsWith('/'), 'must not end with a trailing slash');

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    APP_URL: urlNoTrailingSlash.default('http://localhost:3000'),

    DATABASE_URL: nonEmpty('DATABASE_URL').startsWith(
      'postgres',
      'DATABASE_URL must be a PostgreSQL connection string'
    ),

    // 32 bytes of entropy minimum. Used only to fingerprint session tokens.
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET must be at least 32 characters'),

    // --- Payments ---------------------------------------------------------
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(1500),

    // --- Storage ----------------------------------------------------------
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    S3_REGION: z.string().default('auto'),
    S3_ENDPOINT: z.string().url().optional().or(z.literal('')),
    S3_BUCKET_PRIVATE: z.string().optional(),
    S3_BUCKET_PUBLIC: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    DOWNLOAD_URL_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(3600)
      .default(300),

    // --- Rate limiting ----------------------------------------------------
    RATE_LIMIT_DRIVER: z.enum(['memory', 'redis']).default('memory'),
    REDIS_URL: z.string().optional(),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
  })
  // If the S3 driver is selected, its credentials become mandatory. Catching
  // this at boot avoids a runtime failure on the first customer download.
  .superRefine((cfg, ctx) => {
    if (cfg.STORAGE_DRIVER === 's3') {
      const required = [
        'S3_BUCKET_PRIVATE',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ] as const;
      for (const key of required) {
        if (!cfg[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }

    if (cfg.RATE_LIMIT_DRIVER === 'redis' && !cfg.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when RATE_LIMIT_DRIVER=redis',
      });
    }

    // A production deploy must not run with a placeholder session secret.
    if (cfg.NODE_ENV === 'production') {
      if (cfg.SESSION_SECRET.includes('change-me')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'SESSION_SECRET must be a real secret in production',
        });
      }

      // Cookies are marked Secure in production, so a real deployment served
      // over http would silently fail to keep anyone signed in. Localhost is
      // exempt: `next build` and local production smoke-tests both run with
      // NODE_ENV=production against http://localhost.
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
        cfg.APP_URL
      );

      if (!cfg.APP_URL.startsWith('https://') && !isLocalhost) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_URL'],
          message: 'APP_URL must use https in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${details}\n\n` +
        'See .env.example for the full list of required variables.'
    );
  }

  return parsed.data;
}

export const env: Env = loadEnv();

/**
 * Payments are only "configured" when we can both charge and verify webhooks.
 * Without the webhook secret we could never confirm a payment safely, so we
 * treat the integration as unavailable rather than trusting the client.
 */
export const isPaymentsConfigured = Boolean(
  env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
