import { redirect } from 'next/navigation';
import { DashboardShell, type NavSection } from '@/components/layout/dashboard-shell';
import { getSession } from '@/server/auth/session';
import { securityLog } from '@/lib/logger';

/**
 * Admin shell.
 *
 * The role gate here is a first line of defence that keeps non-admins from
 * even rendering the panel. Every admin *service* re-checks the permission
 * independently, so removing this guard would not by itself expose data — but
 * an attempt to reach it is worth logging either way.
 */
const SECTIONS: NavSection[] = [
  {
    title: 'Plataforma',
    items: [
      { href: '/admin', label: 'Visão geral' },
      { href: '/admin/moderation', label: 'Moderação' },
      { href: '/admin/products', label: 'Produtos' },
      { href: '/admin/users', label: 'Usuários' },
    ],
  },
  {
    title: 'Operação',
    items: [
      { href: '/admin/demands', label: 'Demandas' },
      { href: '/admin/transactions', label: 'Transações' },
      { href: '/admin/audit', label: 'Auditoria' },
    ],
  },
  {
    title: 'Conta',
    items: [{ href: '/dashboard', label: 'Meu painel' }],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  if (!user) redirect('/login?next=%2Fadmin');

  if (!user.roles.includes('ADMIN')) {
    securityLog.warn(
      { userId: user.id, roles: user.roles },
      'non-admin attempted to access admin panel'
    );
    // Redirect rather than 403: an attacker learns nothing about whether the
    // panel exists.
    redirect('/dashboard');
  }

  return (
    <DashboardShell sections={SECTIONS} user={user}>
      {children}
    </DashboardShell>
  );
}
