import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * AUTOMATIZE mark — three nodes joined by two links, transcribed exactly from
 * the Canvas design (two blue nodes, one navy, slate connectors).
 *
 * It reads as "things connected into a flow", which is what the product is.
 */
export function LogoMark({
  size = 26,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={cn('flex-none', className)}
    >
      <circle cx="6" cy="7" r="3.2" fill="#2563EB" />
      <circle cx="6" cy="21" r="3.2" fill="#0B1F3A" />
      <circle cx="21" cy="14" r="3.2" fill="#2563EB" />
      <path
        d="M8.6 8.6 18.4 13M8.6 19.4 18.4 15"
        stroke="#94A3B8"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function Logo({
  href = '/',
  size = 26,
  className,
}: {
  href?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-[10px] text-ink no-underline hover:text-ink',
        className
      )}
    >
      <LogoMark size={size} />
      <span className="text-[19px] font-extrabold tracking-[-0.045em]">
        AUTOMATIZE
      </span>
      <span className="sr-only">— marketplace de soluções de IA</span>
    </Link>
  );
}
