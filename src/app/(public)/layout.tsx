import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { DemoModeBanner } from '@/components/layout/demo-mode-banner';
import { getSession } from '@/server/auth/session';
import { isDatabaseConfigured } from '@/lib/env';

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
      {!isDatabaseConfigured ? <DemoModeBanner /> : null}
      <SiteHeader user={user} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
