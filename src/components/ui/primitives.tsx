import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Small presentational primitives from the Canvas design system:
 * tags, chips, cards, section headers, ratings, avatars and states.
 */

// --- Tag (.tg) --------------------------------------------------------------

type TagTone = 'blue' | 'neutral' | 'ok' | 'warn' | 'danger';

const TAG_TONES: Record<TagTone, string> = {
  blue: 'bg-sky text-blue-700',
  neutral: 'bg-neutral-bg text-neutral-fg',
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  danger: 'bg-danger-bg text-danger-fg',
};

export function Tag({
  tone = 'blue',
  children,
  className,
}: {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[6px] px-[9px] py-[4px] text-[11.5px] font-semibold max-sm:rounded-[7px]',
        TAG_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Maps a product's moderation state to a tag. */
export function StatusTag({ status }: { status: string }) {
  const map: Record<string, { tone: TagTone; label: string }> = {
    DRAFT: { tone: 'neutral', label: 'Rascunho' },
    PENDING_REVIEW: { tone: 'warn', label: 'Em revisão' },
    PUBLISHED: { tone: 'ok', label: 'Publicado' },
    REJECTED: { tone: 'danger', label: 'Rejeitado' },
    ARCHIVED: { tone: 'neutral', label: 'Arquivado' },
    OPEN: { tone: 'ok', label: 'Recebendo propostas' },
    IN_REVIEW: { tone: 'warn', label: 'Em avaliação' },
    AWARDED: { tone: 'blue', label: 'Contratada' },
    CLOSED: { tone: 'neutral', label: 'Fechada' },
    CANCELLED: { tone: 'neutral', label: 'Cancelada' },
    PAID: { tone: 'ok', label: 'Pago' },
    PENDING: { tone: 'warn', label: 'Pendente' },
    FAILED: { tone: 'danger', label: 'Falhou' },
    REFUNDED: { tone: 'neutral', label: 'Reembolsado' },
    SENT: { tone: 'blue', label: 'Enviada' },
    ACCEPTED: { tone: 'ok', label: 'Aceita' },
    WITHDRAWN: { tone: 'neutral', label: 'Retirada' },
    SCHEDULED: { tone: 'warn', label: 'Agendado' },
    ACTIVE: { tone: 'ok', label: 'Ativo' },
    SUSPENDED: { tone: 'warn', label: 'Suspenso' },
    BANNED: { tone: 'danger', label: 'Bloqueado' },
  };

  const entry = map[status] ?? { tone: 'neutral' as TagTone, label: status };
  return <Tag tone={entry.tone}>{entry.label}</Tag>;
}

// --- Chip (.chip) -----------------------------------------------------------

export function Chip({
  active,
  children,
  className,
  ...rest
}: { active?: boolean } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      // Communicates the toggle state to assistive technology, not just colour.
      aria-pressed={active}
      className={cn(
        'flex-none cursor-pointer rounded-full border px-[15px] py-[8px] text-[13px] font-medium transition-colors duration-150',
        'max-sm:min-h-[40px] max-sm:font-semibold',
        active
          ? 'border-blue bg-blue text-white'
          : 'border-line bg-white text-[#334155] hover:border-blue hover:text-blue-700',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Chip that navigates instead of toggling local state (filter links). */
export function ChipLink({
  active,
  href,
  children,
  className,
}: {
  active?: boolean;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex-none rounded-full border px-[15px] py-[8px] text-[13px] font-medium no-underline transition-colors duration-150',
        'max-sm:flex max-sm:min-h-[40px] max-sm:items-center max-sm:font-semibold',
        active
          ? 'border-blue bg-blue text-white hover:text-white'
          : 'border-line bg-white text-[#334155] hover:border-blue hover:text-blue-700',
        className
      )}
    >
      {children}
    </Link>
  );
}

// --- Card (.card) -----------------------------------------------------------

export function Card({
  children,
  className,
  as: Component = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'section' | 'li';
}) {
  return (
    <Component
      className={cn(
        'flex flex-col gap-[10px] rounded-[14px] border border-line bg-white p-[22px] max-sm:rounded-[16px] max-sm:p-4',
        className
      )}
    >
      {children}
    </Component>
  );
}

// --- Section header ---------------------------------------------------------

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  center,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(center && 'text-center', className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          'mt-3 text-[38px] leading-[1.08] font-extrabold max-sm:text-[26px]',
          !eyebrow && 'mt-0'
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-4 text-[17px] leading-[1.55] text-[#475569] max-sm:text-[15px]',
            center && 'mx-auto max-w-[60ch]'
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

// --- Rating -----------------------------------------------------------------

/**
 * Star rating. The visual stars are `aria-hidden` and the real value is given
 * once as text, so a screen reader hears "4,8 de 5" rather than five "star"s.
 */
export function Rating({
  value,
  count,
  className,
}: {
  value: number | null;
  count: number;
  className?: string;
}) {
  if (value === null || count === 0) {
    return (
      <span className={cn('text-[12px] text-muted', className)}>
        Sem avaliações
      </span>
    );
  }

  const label = value.toFixed(1).replace('.', ',');

  return (
    <span className={cn('inline-flex items-center gap-1 text-[12px]', className)}>
      <span aria-hidden="true" className="text-star">
        ★
      </span>
      <span className="font-bold text-ink">{label}</span>
      <span className="text-muted">({count})</span>
      <span className="sr-only">
        {label} de 5, {count} avaliações
      </span>
    </span>
  );
}

// --- Avatar -----------------------------------------------------------------

/** Initials avatar. No external image request, no layout shift. */
export function Avatar({
  name,
  size = 34,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid flex-none place-items-center rounded-full bg-sky font-bold text-blue-700',
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials}
    </span>
  );
}

// --- Thumbnail --------------------------------------------------------------

export function Thumb({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('thumb block rounded-[10px] max-sm:rounded-[12px]', className)}
    />
  );
}

// --- States -----------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-dashed border-line bg-bg px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-muted">{icon}</div> : null}
      <p className="text-[17px] font-bold">{title}</p>
      <p className="mt-2 max-w-[46ch] text-[14.5px] leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Não foi possível carregar',
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-[14px] border border-line bg-danger-bg px-6 py-12 text-center"
    >
      <p className="text-[17px] font-bold text-danger-fg">{title}</p>
      <p className="mt-2 max-w-[46ch] text-[14.5px] leading-relaxed text-[#7f1d1d]">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('skeleton block rounded-[8px]', className)}
    />
  );
}

/** Card-shaped skeleton used by product and professional list suspense states. */
export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-[10px] rounded-[14px] border border-line bg-white p-4">
      <Skeleton className="h-[110px] w-full rounded-[10px]" />
      <Skeleton className="h-[18px] w-[70px]" />
      <Skeleton className="h-[16px] w-[85%]" />
      <Skeleton className="h-[14px] w-full" />
      <Skeleton className="h-[14px] w-[60%]" />
      <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
        <Skeleton className="h-[14px] w-[60px]" />
        <Skeleton className="h-[18px] w-[70px]" />
      </div>
    </div>
  );
}

// --- Layout helpers ---------------------------------------------------------

/** Page container. Matches the Canvas `.w` rule (max 1200px, 80px gutters). */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1200px] px-20 max-lg:px-10 max-sm:px-5',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Divider used between dashboard sections. */
export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-line', className)} />;
}
