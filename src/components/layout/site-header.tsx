'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button, LinkButton } from '@/components/ui/button';
import { Avatar } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import type { SessionUser } from '@/server/auth/session';

/**
 * Site header.
 *
 * Sticky, translucent with a backdrop blur, matching the Canvas design. On
 * mobile the nav collapses into a disclosure panel; the persistent tab bar at
 * the bottom carries primary navigation instead.
 */

const NAV = [
  { href: '/products', label: 'Produtos' },
  { href: '/professionals', label: 'Profissionais' },
  { href: '/companies', label: 'Empresas' },
  { href: '/demands', label: 'Demandas' },
  { href: '/sell', label: 'Vender' },
  { href: '/founders', label: 'Fundadores' },
  { href: '/about', label: 'Quem somos' },
] as const;

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Any navigation closes the panel; leaving it open across a route change
  // strands the user on a new page behind an overlay.
  //
  // Adjusted during render rather than in an effect: React re-runs this
  // component immediately with the corrected state, before painting, so the
  // panel never flashes open on the new route.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  // Escape closes the panel, as expected of any dismissible overlay.
  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-60 border-b border-line bg-white/93 backdrop-blur-[10px]">
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-6 px-14 py-[18px] max-lg:gap-5 max-lg:px-10 max-sm:px-5 max-sm:py-3">
        <Logo className="mr-auto" />

        <nav aria-label="Principal" className="flex items-center gap-4 max-lg:hidden xl:gap-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'border-b-2 py-2 text-[13.5px] whitespace-nowrap no-underline transition-colors xl:text-[14.5px]',
                isActive(item.href)
                  ? 'border-blue font-bold text-blue-700'
                  : 'border-transparent font-medium text-[#334155] hover:text-blue-700'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <span
          aria-hidden="true"
          className="h-[22px] w-px bg-line max-lg:hidden"
        />

        {user ? (
          <div className="flex items-center gap-4 max-lg:hidden">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-[14.5px] font-medium text-[#334155] no-underline hover:text-blue-700"
            >
              <Avatar name={user.name} size={28} />
              <span className="max-w-[14ch] truncate">{user.name}</span>
            </Link>
            <LinkButton href="/library" variant="secondary" size="sm">
              Biblioteca
            </LinkButton>
          </div>
        ) : (
          <div className="flex items-center gap-4 max-lg:hidden">
            <Link
              href="/login"
              className="py-2 text-[14.5px] font-medium text-[#334155] no-underline hover:text-blue-700"
            >
              Entrar
            </Link>
            <LinkButton href="/register">Começar agora</LinkButton>
          </div>
        )}

        {/* Wrapper carries the responsive display. Putting `hidden` on the
            Button itself would collide with the `inline-flex` in its own base
            classes — same specificity, so stylesheet order decides and the
            button leaks onto desktop. */}
        <div className="lg:hidden">
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              {menuOpen ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          aria-label="Menu"
          className="border-t border-line bg-white px-5 py-4 lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'block rounded-[10px] px-3 py-3 text-[15px] no-underline',
                    isActive(item.href)
                      ? 'bg-sky font-bold text-blue-700'
                      : 'font-medium text-[#334155]'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {user ? (
              <>
                <LinkButton href="/dashboard" variant="secondary" fullWidth>
                  Meu dashboard
                </LinkButton>
                <LinkButton href="/library" fullWidth>
                  Minha biblioteca
                </LinkButton>
              </>
            ) : (
              <>
                <LinkButton href="/login" variant="secondary" fullWidth>
                  Entrar
                </LinkButton>
                <LinkButton href="/register" fullWidth>
                  Começar agora
                </LinkButton>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
