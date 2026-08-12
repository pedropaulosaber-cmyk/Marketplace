'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

/**
 * Dashboard / admin shell.
 *
 * A persistent left rail on desktop; on mobile the same items become a
 * horizontally scrollable strip so every destination stays reachable without a
 * hamburger.
 */

export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export function DashboardShell({
  sections,
  user,
  children,
}: {
  sections: NavSection[];
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Exact match for index routes, prefix match for their children, so
  // /dashboard does not stay highlighted on /dashboard/products.
  const isActive = (href: string) =>
    pathname === href ||
    (href !== '/dashboard' && href !== '/admin' && pathname.startsWith(`${href}/`));

  return (
    <div className="grid min-h-dvh grid-cols-[248px_1fr] max-lg:grid-cols-1">
      <aside className="flex flex-col gap-6 border-r border-line bg-bg px-5 py-6 max-lg:border-r-0 max-lg:border-b max-lg:py-4">
        <Logo size={24} />

        <nav aria-label="Painel" className="flex flex-col gap-6 max-lg:hidden">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-[11px] font-extrabold tracking-[0.12em] text-muted uppercase">
                {section.title}
              </p>
              <ul className="flex flex-col gap-[2px]">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={cn(
                        'block rounded-[8px] px-[11px] py-[9px] text-[13.5px] no-underline transition-colors',
                        isActive(item.href)
                          ? 'bg-sky font-bold text-blue-700'
                          : 'text-[#475569] hover:bg-white hover:text-ink'
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Mobile: one flat scroller instead of collapsed sections. */}
        <nav
          aria-label="Painel"
          // Mobile-first: visible by default, hidden from lg up. Avoids two
          // competing `display` utilities resolving by stylesheet order.
          className="no-scrollbar flex gap-2 overflow-x-auto lg:hidden"
        >
          {sections.flatMap((section) =>
            section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'flex-none rounded-full border px-[15px] py-[9px] text-[13px] no-underline',
                  isActive(item.href)
                    ? 'border-blue bg-blue font-bold text-white hover:text-white'
                    : 'border-line bg-white font-medium text-[#334155]'
                )}
              >
                {item.label}
              </Link>
            ))
          )}
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-line pt-4 max-lg:hidden">
          <Avatar name={user.name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{user.name}</p>
            <p className="truncate text-[11.5px] text-muted">{user.email}</p>
          </div>
        </div>

        <Link
          href="/"
          className="text-[12.5px] text-muted no-underline hover:text-blue-700 max-lg:hidden"
        >
          ← Voltar ao site
        </Link>
      </aside>

      {/* Each page renders its own <h1>, so the shell stays reusable between
          the seller dashboard and the admin panel. */}
      <main id="main" className="min-w-0 px-10 py-8 max-sm:px-5 max-sm:py-6">
        {children}
      </main>
    </div>
  );
}
