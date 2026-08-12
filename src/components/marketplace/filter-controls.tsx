'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';

/**
 * URL-driven filter controls.
 *
 * Filter state lives in the query string, not component state. That keeps the
 * page a Server Component (filtering happens in SQL), makes every result set
 * shareable and bookmarkable, and gives the back button the behaviour users
 * expect.
 */

function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());

    if (value === null || value === '' || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    // Any filter change resets to the first page — staying on page 7 of a
    // narrower result set would show an empty screen.
    if (key !== 'page') next.delete('page');

    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  return { params, pending, setParam };
}

/** Debounced search box. */
export function SearchInput({
  placeholder = 'Buscar…',
  label,
}: {
  placeholder?: string;
  label: string;
}) {
  const { params, setParam, pending } = useFilterNav();
  const id = useId();

  const urlQuery = params.get('q') ?? '';
  const [value, setValue] = useState(urlQuery);

  // Keeps the field in sync when the URL changes from elsewhere (back button,
  // a "clear filters" click). Adjusted during render rather than in an effect
  // so the input never briefly shows the stale value.
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  // Debounce so typing does not fire a query per keystroke.
  useEffect(() => {
    if (value === urlQuery) return;

    const timer = setTimeout(() => setParam('q', value || null), 320);
    return () => clearTimeout(timer);
    // `setParam` is recreated each render; including it would reset the timer
    // on every keystroke and defeat the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, urlQuery]);

  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#94A3B8"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-[14px] -translate-y-1/2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-[10px] border border-line bg-white py-[12px] pr-4 pl-[42px] text-[14.5px]',
          'placeholder:text-muted focus:border-blue focus:outline-2 focus:outline-blue focus:outline-offset-[-1px]',
          'max-sm:min-h-[48px] max-sm:rounded-[12px] max-sm:text-[16px]',
          pending && 'opacity-70'
        )}
      />
    </div>
  );
}

/** Sort <select>. A native select is the most usable control on mobile. */
export function SortSelect({
  options,
  defaultValue = 'rel',
}: {
  options: ReadonlyArray<{ id: string; label: string }>;
  defaultValue?: string;
}) {
  const { params, setParam } = useFilterNav();
  const id = useId();
  const current = params.get('sort') ?? defaultValue;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        Ordenar
      </label>
      <select
        id={id}
        value={current}
        onChange={(e) => setParam('sort', e.target.value)}
        className="cursor-pointer rounded-[10px] border border-line bg-white px-3 py-[11px] text-[13.5px] focus:border-blue focus:outline-2 focus:outline-blue focus:outline-offset-[-1px] max-sm:min-h-[44px]"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A group of mutually exclusive radio filters, with result counts. */
export function FilterGroup({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: ReadonlyArray<{ id: string; label: string; count?: number }>;
}) {
  const { params, setParam } = useFilterNav();
  const current = params.get(name) ?? 'all';

  return (
    <fieldset className="border-0 p-0">
      <legend className="text-[11px] font-extrabold tracking-[0.12em] text-muted uppercase">
        {label}
      </legend>
      <div className="mt-3 flex flex-col gap-[2px]">
        {options.map((option) => {
          const active = current === option.id;

          return (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-[9px] py-[5px] text-[13.5px]"
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={active}
                onChange={() => setParam(name, option.id)}
                className="h-[15px] w-[15px] accent-blue"
              />
              <span
                className={cn(
                  'flex-1',
                  active ? 'font-bold text-blue-700' : 'text-[#334155]'
                )}
              >
                {option.label}
              </span>
              {option.count !== undefined ? (
                <span className="text-[12px] text-muted">{option.count}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Horizontal category chips. Scrolls on mobile, wraps on desktop. */
export function CategoryChips({
  categories,
  paramName = 'category',
}: {
  categories: readonly string[];
  paramName?: string;
}) {
  const { params, setParam } = useFilterNav();
  const current = params.get(paramName) ?? 'Todos';

  return (
    <div
      role="group"
      aria-label="Filtrar por categoria"
      className="no-scrollbar flex gap-[10px] overflow-x-auto pb-1 max-sm:-mx-5 max-sm:px-5 sm:flex-wrap"
    >
      {categories.map((category) => {
        const active = current === category;

        return (
          <button
            key={category}
            type="button"
            aria-pressed={active}
            onClick={() => setParam(paramName, category === 'Todos' ? null : category)}
            className={cn(
              'flex-none cursor-pointer rounded-full border px-[15px] py-[8px] text-[13px] font-medium transition-colors',
              'max-sm:min-h-[40px] max-sm:font-semibold',
              active
                ? 'border-blue bg-blue text-white'
                : 'border-line bg-white text-[#334155] hover:border-blue hover:text-blue-700'
            )}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}

export function ClearFiltersButton({ keys }: { keys: readonly string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const hasAny = keys.some((key) => params.get(key));
  if (!hasAny) return null;

  function clear() {
    const next = new URLSearchParams(params.toString());
    for (const key of keys) next.delete(key);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={clear}
      className="cursor-pointer text-[13.5px] font-semibold text-blue-700 underline-offset-2 hover:underline"
    >
      Limpar filtros
    </button>
  );
}
