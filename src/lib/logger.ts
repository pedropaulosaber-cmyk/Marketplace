import 'server-only';
import pino from 'pino';
import { env, isProduction } from './env';

/**
 * Structured application logger.
 *
 * Every log line is JSON in production so it can be shipped and queried.
 * Sensitive fields are redacted centrally — never rely on call sites
 * remembering to strip a password or token.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    // Redaction is central on purpose: a call site that has to remember to
    // strip a secret is a call site that will eventually forget. New fields
    // belong here, not in a `delete` at the point of logging.
    paths: [
      'password',
      'passwordHash',
      'token',
      'sessionToken',
      'secret',
      'clientSecret',
      'apiKey',
      'authorization',
      'cookie',
      // Payment and referral identifiers. Not credentials, but they are
      // bearer-ish: a leaked client secret completes a payment, and a leaked
      // referral code lets someone hijack an attribution.
      'referralCode',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.secret',
      '*.clientSecret',
      '*.apiKey',
      '*.authorization',
      '*.cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[redacted]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },
        },
      }),
});

/** Logger bound to a subsystem, e.g. `log('checkout')`. */
export function log(module: string) {
  return logger.child({ module });
}

/**
 * Security-relevant events (auth attempts, permission denials, webhook
 * verification failures). Kept on its own channel so it can be routed to a
 * separate sink and alerted on.
 */
export const securityLog = logger.child({ channel: 'security' });
