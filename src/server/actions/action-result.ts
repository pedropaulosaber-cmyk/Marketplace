import 'server-only';
import { ZodError, type z } from 'zod';
import { isAppError, toUserMessage } from '@/lib/errors';
import { log } from '@/lib/logger';
import { captureError } from '@/lib/monitoring';

const logger = log('actions');

/**
 * Uniform result shape for every Server Action.
 *
 * Actions never throw across the network boundary: an uncaught error in a
 * Server Action surfaces to the browser as an opaque digest, which gives the
 * user nothing actionable. Returning a typed result lets forms render precise,
 * field-level feedback while keeping internals server-side.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fields?: Record<string, string[]>
): ActionResult<never> {
  return { ok: false, error, fields };
}

/**
 * Wraps an action body with validation and error normalization.
 *
 * Validation failures become field errors; known application errors become
 * their user-safe message; anything else is logged with full detail and
 * reported generically, so a stack trace or SQL fragment never reaches a user.
 */
export async function action<TSchema extends z.ZodTypeAny, TResult>(
  schema: TSchema,
  input: unknown,
  handler: (parsed: z.infer<TSchema>) => Promise<TResult>
): Promise<ActionResult<TResult>> {
  let parsed: z.infer<TSchema>;

  try {
    parsed = schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(
        'Confira os campos destacados.',
        error.flatten().fieldErrors as Record<string, string[]>
      );
    }
    throw error;
  }

  try {
    return ok(await handler(parsed));
  } catch (error) {
    if (isAppError(error)) {
      // Expected, already user-safe. Logged at info so the volume is visible
      // without being treated as a fault.
      logger.info(
        { code: error.code, message: error.message },
        'action rejected'
      );
      return fail(error.message, error.fields);
    }

    logger.error({ err: error }, 'unhandled action error');
    captureError(error);
    return fail(toUserMessage(error));
  }
}

/** Same normalization for actions that take no input. */
export async function simpleAction<TResult>(
  handler: () => Promise<TResult>
): Promise<ActionResult<TResult>> {
  try {
    return ok(await handler());
  } catch (error) {
    if (isAppError(error)) {
      logger.info({ code: error.code }, 'action rejected');
      return fail(error.message, error.fields);
    }
    logger.error({ err: error }, 'unhandled action error');
    captureError(error);
    return fail(toUserMessage(error));
  }
}

/** Converts FormData into a plain object, collecting repeated keys as arrays. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue; // files go through the upload flow

    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }

  return out;
}
