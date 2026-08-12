import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Pagination.
 *
 * Rendered as real links so pages are crawlable, shareable and work without
 * JavaScript. Long ranges collapse to first/last plus a window around the
 * current page.
 */
export function Pagination({
  page,
  pageCount,
  buildHref,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const pages: Array<number | 'gap'> = [];
  const window = 1;

  for (let n = 1; n <= pageCount; n += 1) {
    const nearCurrent = Math.abs(n - page) <= window;
    const isEdge = n === 1 || n === pageCount;

    if (nearCurrent || isEdge) {
      pages.push(n);
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap');
    }
  }

  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-center">
      <ul className="flex items-center gap-2">
        <li>
          {page > 1 ? (
            <Link
              href={buildHref(page - 1)}
              rel="prev"
              className="flex min-h-[40px] items-center rounded-[8px] border border-line bg-white px-[15px] text-[13.5px] font-semibold text-ink no-underline hover:border-blue hover:text-blue-700"
            >
              ← Anterior
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="flex min-h-[40px] items-center rounded-[8px] border border-line bg-bg px-[15px] text-[13.5px] font-semibold text-muted"
            >
              ← Anterior
            </span>
          )}
        </li>

        {pages.map((entry, index) =>
          entry === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={buildHref(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[8px] border px-[15px] text-[13.5px] font-semibold no-underline',
                  entry === page
                    ? 'border-blue bg-blue text-white hover:text-white'
                    : 'border-line bg-white text-ink hover:border-blue hover:text-blue-700'
                )}
              >
                {entry}
                {entry === page ? <span className="sr-only"> (página atual)</span> : null}
              </Link>
            </li>
          )
        )}

        <li>
          {page < pageCount ? (
            <Link
              href={buildHref(page + 1)}
              rel="next"
              className="flex min-h-[40px] items-center rounded-[8px] border border-line bg-white px-[15px] text-[13.5px] font-semibold text-ink no-underline hover:border-blue hover:text-blue-700"
            >
              Próxima →
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="flex min-h-[40px] items-center rounded-[8px] border border-line bg-bg px-[15px] text-[13.5px] font-semibold text-muted"
            >
              Próxima →
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
