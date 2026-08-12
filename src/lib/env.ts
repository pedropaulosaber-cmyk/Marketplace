import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * Server-side environment configuration.
 *
 * Parsed once, at module load. An invalid configuration throws immediately so
 * a misconfigured deploy fails at boot instead of leaking a half-working app
 * (e.g. a checkout that silently runs without a webhook secret).
 *
 * DATABASE_URL and SESSION_SECRET are the one exception: they fall back to a
 * safe placeholder instead of refusing to boot. This exists so the app can be
 * deployed and reachable at a public URL *before* a real database is wired
 * up — every database-backed request will then fail gracefully through the
 * app's normal error handling (the action wrapper's catch-all, or the route
 * error boundary) rather than the whole process refusing to start. Once a
 * real DATABASE_URL is set, this fallback never engages and the app behaves
 * exactly as before. `isDatabaseConfigured` / `isSessionConfigured` tell
 * callers (health check, logs) which mode is active.
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

    // Both fall back to a placeholder in loadEnv() below when unset, so they
    // are optional here — the schema still enforces their *shape* whenever a
    // real value (or the fallback) is present.
    DATABASE_URL: nonEmpty('DATABASE_URL')
      .startsWith('postgres', 'DATABASE_URL must be a PostgreSQL connection string')
      .optional(),

    // 32 bytes of entropy minimum. Used only to fingerprint session tokens.
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET must be at least 32 characters')
      .optional(),

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
    // `database` is the right default anywhere the process is not long-lived.
    // On serverless each request can land on a fresh instance, so an
    // in-process counter resets constantly and an attacker gets an unlimited
    // number of "first attempts" — the limiter looks present and enforces
    // almost nothing.
    RATE_LIMIT_DRIVER: z.enum(['memory', 'database', 'redis']).default('database'),
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
    // `?? false`: the field is optional in the schema (it falls back to a
    // generated value before parsing, in loadEnv() below), but the type
    // checker only sees the schema, not that runtime guarantee.
    if (cfg.NODE_ENV === 'production') {
      if (cfg.SESSION_SECRET?.includes('change-me') ?? false) {
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

/**
 * DATABASE_URL and SESSION_SECRET are guaranteed non-empty strings on the
 * exported `env` object — `loadEnv()` fills them in when absent — even though
 * the schema itself marks them optional (that's what lets a deploy boot
 * without them). Every other consumer in the app can keep treating them as
 * plain required strings.
 */
export type Env = Omit<
  z.infer<typeof envSchema>,
  'DATABASE_URL' | 'SESSION_SECRET'
> & {
  DATABASE_URL: string;
  SESSION_SECRET: string;
};

/**
 * Obviously-fake connection string: syntactically valid enough to satisfy
 * the schema and to let `PrismaClient` construct (which never connects
 * eagerly), but any real query against it fails fast and loudly rather than
 * silently pointing at a real database by accident.
 */
const PLACEHOLDER_DATABASE_URL =
  'postgresql://unconfigured:unconfigured@database-not-configured.invalid:5432/unconfigured';

function loadEnv(): Env {
  const usingPlaceholderDatabase = !process.env.DATABASE_URL;
  const usingGeneratedSecret = !process.env.SESSION_SECRET;

  // Inject fallbacks into a *copy* of process.env before validation, so the
  // rest of the schema (including the superRefine checks below) always sees
  // a complete, well-shaped configuration — real value or fallback.
  const candidate: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || PLACEHOLDER_DATABASE_URL,
    SESSION_SECRET:
      process.env.SESSION_SECRET || randomBytes(48).toString('base64'),
  };

  const parsed = envSchema.safeParse(candidate);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${details}\n\n` +
        'See .env.example for the full list of required variables.'
    );
  }

  if (usingPlaceholderDatabase) {
    // `logger` imports this module, so it cannot be used here without a
    // cycle — this is the one place in the app that talks to stderr directly.
    console.warn(
      '[env] DATABASE_URL is not set. Booting without a database: every ' +
        'database-backed request (auth, catalog, checkout, everything else ' +
        'that reads or writes data) will fail until a real DATABASE_URL is ' +
        'configured. The app stays up and shows its normal error state for ' +
        'those requests rather than crashing.'
    );
  }

  if (usingGeneratedSecret) {
    console.warn(
      '[env] SESSION_SECRET is not set. Using a random value generated for ' +
        'this boot only: existing sessions will not survive a restart or a ' +
        'redeploy, and this instance will not agree with any other running ' +
        'instance. Set SESSION_SECRET before relying on login.'
    );
  }

  return parsed.data as Env;
}

export const env: Env = loadEnv();

/** True once a real DATABASE_URL has been provided, not the boot fallback. */
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

/** True once a real SESSION_SECRET has been provided, not the boot fallback. */
export const isSessionConfigured = Boolean(process.env.SESSION_SECRET);

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
