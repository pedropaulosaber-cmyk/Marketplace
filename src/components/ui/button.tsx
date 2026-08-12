import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Button — transcribed from the Canvas `.b` / `.b-p` / `.b-s` / `.b-g` rules.
 *
 * Renders a real <button> or a <Link>, never a clickable <div>: keyboard
 * activation, focus order and assistive-technology semantics all come free
 * from the correct element.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold cursor-pointer ' +
  'border border-transparent rounded-[8px] transition-[background-color,border-color,transform,box-shadow] ' +
  'duration-150 focus-visible:outline-2 focus-visible:outline-blue focus-visible:outline-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-55 disabled:pointer-events-none ' +
  'active:translate-y-px whitespace-nowrap';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-blue text-white hover:bg-blue-700 hover:shadow-[0_6px_18px_rgb(37_99_235/0.28)]',
  secondary:
    'bg-white text-ink border-line hover:border-blue hover:text-blue-700 hover:bg-sky',
  ghost: 'bg-transparent text-blue-700 hover:bg-sky',
  dark: 'bg-blue-900 text-white hover:bg-[#132c4f]',
  danger:
    'bg-white text-danger-fg border-line hover:border-danger-fg hover:bg-danger-bg',
};

const SIZES: Record<Size, string> = {
  // Every size clears the 44px minimum touch target on mobile.
  sm: 'text-[13.5px] px-[14px] py-[9px] min-h-[38px] max-sm:min-h-[44px]',
  md: 'text-[15px] px-[22px] py-[13px] min-h-[46px]',
  lg: 'text-[16px] px-[28px] py-[15px] min-h-[52px]',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonProps = CommonProps &
  Omit<ComponentProps<'button'>, 'className' | 'children'>;

type LinkButtonProps = CommonProps &
  Omit<ComponentProps<typeof Link>, 'className' | 'children'>;

function classesFor({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
}: Pick<CommonProps, 'variant' | 'size' | 'fullWidth' | 'className'>): string {
  return cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className
  );
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // Defaulting to "button" avoids the classic bug of an unmarked button
      // inside a form submitting it by accident.
      type={type}
      className={classesFor({ variant, size, fullWidth, className })}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={classesFor({ variant, size, fullWidth, className })}
      {...rest}
    >
      {children}
    </Link>
  );
}
