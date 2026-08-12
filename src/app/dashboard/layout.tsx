import { redirect } from 'next/navigation';
import { DashboardShell, type NavSection } from '@/components/layout/dashboard-shell';
import { getSession } from '@/server/auth/session';

/**
 * Dashboard shell for creators, professionals and buyers.
 *
 * Navigation adapts to the roles the account actually holds — a buyer never
 * sees the seller sections. This is a UI affordance only: every page and
 * action behind these links enforces its own permission check.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect('/login?next=%2Fdashboard');

  const isCreator = user.roles.includes('CREATOR');
  const isProfessional = user.roles.includes('PROFESSIONAL');
  const isAdmin = user.roles.includes('ADMIN');

  const sections: NavSection[] = [
    {
      title: 'Geral',
      items: [
        { href: '/dashboard', label: 'Visão geral' },
        { href: '/library', label: 'Biblioteca' },
        { href: '/favorites', label: 'Favoritos' },
      ],
    },
  ];

  if (isCreator) {
    sections.push({
      title: 'Criador',
      items: [
        { href: '/dashboard/products', label: 'Produtos' },
        { href: '/dashboard/sales', label: 'Vendas' },
        { href: '/dashboard/customers', label: 'Clientes' },
        { href: '/dashboard/analytics', label: 'Analytics' },
        { href: '/dashboard/earnings', label: 'Receitas' },
      ],
    });
  }

  sections.push({
    title: 'Contratação',
    items: [
      { href: '/dashboard/demands', label: 'Minhas demandas' },
      ...(isProfessional
        ? [{ href: '/dashboard/proposals', label: 'Minhas propostas' }]
        : []),
    ],
  });

  sections.push({
    title: 'Conta',
    items: [
      { href: '/dashboard/profile', label: 'Perfil' },
      { href: '/dashboard/settings', label: 'Configurações' },
      ...(isAdmin ? [{ href: '/admin', label: 'Administração' }] : []),
    ],
  });

  return (
    <DashboardShell sections={sections} user={user}>
      {children}
    </DashboardShell>
  );
}
