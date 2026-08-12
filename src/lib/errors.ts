/**
 * Application error taxonomy.
 *
 * Services throw these instead of generic `Error`s so callers (server actions,
 * route handlers) can map a failure to the right HTTP status and the right
 * user-facing message without string-matching.
 *
 * `message` is safe to show a user. Anything sensitive belongs in the log, not
 * in the message — an authorization failure must never explain *why* access
 * was denied, or it becomes an enumeration oracle.
 */

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYMENT_REQUIRED'
  | 'UNAVAILABLE'
  | 'INTERNAL';

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT_REQUIRED: 402,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Field-level messages for form rendering. */
  readonly fields?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { fields?: Record<string, string[]>; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.fields = options?.fields;
  }
}

export const unauthenticated = (msg = 'Você precisa entrar para continuar.') =>
  new AppError('UNAUTHENTICATED', msg);

/**
 * Deliberately vague. Distinguishing "does not exist" from "you may not see
 * this" would let an attacker enumerate private resources by their id.
 */
export const forbidden = (msg = 'Você não tem permissão para esta ação.') =>
  new AppError('FORBIDDEN', msg);

export const notFound = (msg = 'Não encontramos o que você procura.') =>
  new AppError('NOT_FOUND', msg);

export const validation = (
  msg: string,
  fields?: Record<string, string[]>
) => new AppError('VALIDATION', msg, { fields });

export const conflict = (msg: string) => new AppError('CONFLICT', msg);

export const rateLimited = (
  msg = 'Muitas tentativas. Tente novamente em instantes.'
) => new AppError('RATE_LIMITED', msg);

export const unavailable = (msg: string) => new AppError('UNAVAILABLE', msg);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/**
 * Normalizes an unknown thrown value into a user-safe message. Unknown errors
 * are flattened to a generic message so internal details (SQL text, stack
 * frames, provider payloads) never reach the browser.
 */
export function toUserMessage(e: unknown): string {
  if (isAppError(e)) return e.message;
  return 'Algo deu errado. Tente novamente em instantes.';
}
