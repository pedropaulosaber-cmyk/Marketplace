import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { getSession } from '@/server/auth/session';

/**
 * Shell for signed-in, buyer-facing pages (library, favourites, orders,
 * checkout).
 *
 * The session gate lives here so every route in the group is protected by
 * default — a new page cannot forget to check. Services re-verify
 * authorization independently; this only decides what gets rendered.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  if (!user) redirect('/login');

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader user={user} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
