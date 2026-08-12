import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/primitives';
import { DataTable, PageHeader, Panel, Td } from '@/components/dashboard/panels';
import { requireUser } from '@/server/auth/rbac';
import { getSellerCustomers } from '@/server/services/analytics-service';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Clientes',
  robots: { index: false, follow: false },
};

/**
 * Buyers who purchased from this seller.
 *
 * Only the data a seller legitimately needs to support a customer is shown —
 * name, contact and their purchase history with *this* seller. Nothing about
 * their activity elsewhere on the platform is exposed.
 */
export default async function CustomersPage() {
  const user = await requireUser();

  if (!user.roles.includes('CREATOR') && !user.roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const customers = await getSellerCustomers(user.id);
  const total = customers.reduce((sum, c) => sum + c.totalCents, 0);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Quem comprou seus produtos. Use estes dados apenas para suporte e atendimento."
      />

      <Panel
        title={`${customers.length} ${customers.length === 1 ? 'cliente' : 'clientes'}`}
        description={`Total comprado: ${formatMoney(total)}`}
      >
        {customers.length === 0 ? (
          <EmptyState
            title="Nenhum cliente ainda"
            description="Seus compradores aparecem aqui depois da primeira venda."
          />
        ) : (
          <DataTable
            caption="Seus clientes"
            headers={['Cliente', 'E-mail', 'Pedidos', 'Total', 'Última compra']}
          >
            {customers.map((customer) => (
              <tr key={customer.id}>
                <Td bold>{customer.name}</Td>
                <Td muted>{customer.email}</Td>
                <Td>{customer.orders}</Td>
                <Td bold>{formatMoney(customer.totalCents)}</Td>
                <Td muted>
                  {customer.lastAt
                    ? customer.lastAt.toLocaleDateString('pt-BR')
                    : '—'}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
