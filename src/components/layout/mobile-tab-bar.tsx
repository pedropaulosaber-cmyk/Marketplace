'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * Persistent bottom navigation on mobile, matching the mobile Canvas artifact.
 *
 * Hidden entirely on desktop, where the header nav does this job. Sits above
 * the safe-area inset so it clears the home indicator on modern phones.
 */

const TABS = [
  {
    href: '/',
    label: 'Início',
    icon: (
      <path
        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"
        strokeWidth="1.7"
      />
    ),
  },
  {
    href: '/products',
    label: 'Produtos',
    icon: (
      <>
        <path d="M4 7h16v13H4z" strokeWidth="1.7" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" strokeWidth="1.7" />
      </>
    ),
  },
  {
    href: '/professionals',
    label: 'Profissionais',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.4" strokeWidth="1.7" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeWidth="1.7" />
      </>
    ),
  },
  {
    href: '/demands',
    label: 'Demandas',
    icon: (
      <>
        <path d="M6 4h12v16H6z" strokeWidth="1.7" />
        <path d="M9 9h6M9 13h6M9 17h3" strokeWidth="1.7" />
      </>
    ),
  },
  {
    href: '/library',
    label: 'Biblioteca',
    icon: (
      <>
        <path d="M5 5h5v14H5zM14 5h5v14h-5z" strokeWidth="1.7" />
      </>
    ),
  },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-70 hidden border-t border-line bg-white/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-[10px] max-sm:block"
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const active = isActive(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-[3px] px-1 py-2 no-underline',
                  active ? 'text-blue-700' : 'text-muted'
                )}
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {tab.icon}
                </svg>
                <span
                  className={cn(
                    'text-[10px] leading-none',
                    active ? 'font-bold' : 'font-medium'
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
