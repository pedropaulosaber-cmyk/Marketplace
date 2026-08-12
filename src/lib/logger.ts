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
    paths: [
      'password',
      'passwordHash',
      'token',
      'sessionToken',
      'secret',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.secret',
      'req.headers.authorization',
      'req.headers.cookie',
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
