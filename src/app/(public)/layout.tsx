import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { getSession } from '@/server/auth/session';

/**
 * Public shell: header, content, footer, and the mobile tab bar.
 *
 * The session is resolved once here and passed down, so the header does not
 * trigger its own fetch and the page stays a Server Component.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

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
