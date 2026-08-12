import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Form field primitives.
 *
 * Accessibility is built in rather than left to call sites: every control gets
 * a real <label for>, errors are wired through `aria-describedby` and
 * `aria-invalid`, and error text is announced via `role="alert"`.
 *
 * Font size on inputs is 16px on mobile — anything smaller makes iOS Safari
 * zoom on focus.
 */

const CONTROL =
  'block w-full rounded-[10px] border border-line bg-white px-[14px] py-[12px] ' +
  'text-[15px] text-ink transition-colors placeholder:text-muted ' +
  'focus:border-blue focus:outline-2 focus:outline-blue focus:outline-offset-[-1px] ' +
  'disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted ' +
  'max-sm:min-h-[48px] max-sm:rounded-[12px] max-sm:text-[16px]';

const INVALID = 'border-danger-fg focus:border-danger-fg focus:outline-danger-fg';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string[];
  required?: boolean;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error?.length);

  const describedBy =
    [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="text-[12.5px] font-bold tracking-[0.01em] text-[#334155]"
      >
        {label}
        {required ? (
          <span className="ml-1 text-danger-fg" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="mt-1 text-[12.5px] text-muted">
          {hint}
        </p>
      ) : null}

      <div className="mt-[6px]">{children({ id, describedBy, invalid })}</div>

      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="mt-[6px] text-[12.5px] font-medium text-danger-fg"
        >
          {error?.[0]}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string[];
} & Omit<ComponentProps<'input'>, 'id' | 'className'> & { className?: string }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(CONTROL, invalid && INVALID, className)}
          {...rest}
        />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  error,
  required,
  className,
  rows = 5,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string[];
} & Omit<ComponentProps<'textarea'>, 'id' | 'className'> & {
    className?: string;
  }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(CONTROL, 'resize-y leading-relaxed', invalid && INVALID, className)}
          {...rest}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  className,
  children,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string[];
  children: ReactNode;
} & Omit<ComponentProps<'select'>, 'id' | 'className' | 'children'> & {
    className?: string;
  }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(CONTROL, 'cursor-pointer pr-9', invalid && INVALID, className)}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({
  label,
  error,
  className,
  ...rest
}: {
  label: ReactNode;
  error?: string[];
} & Omit<ComponentProps<'input'>, 'type' | 'className'> & {
    className?: string;
  }) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = Boolean(error?.length);

  return (
    <div>
      <div className="flex items-start gap-[10px]">
        <input
          id={id}
          type="checkbox"
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid || undefined}
          className={cn(
            'mt-[3px] h-[17px] w-[17px] flex-none cursor-pointer accent-blue',
            className
          )}
          {...rest}
        />
        <label
          htmlFor={id}
          className="cursor-pointer text-[13.5px] leading-[1.5] text-[#334155]"
        >
          {label}
        </label>
      </div>
      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="mt-[6px] text-[12.5px] font-medium text-danger-fg"
        >
          {error?.[0]}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Form-level error banner, for failures that are not tied to one field
 * (rate limiting, a service being unavailable).
 */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-[10px] border border-danger-fg/25 bg-danger-bg px-4 py-3 text-[13.5px] font-medium text-danger-fg"
    >
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="rounded-[10px] border border-ok-fg/25 bg-ok-bg px-4 py-3 text-[13.5px] font-medium text-ok-fg"
    >
      {message}
    </div>
  );
}
