import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { DataTable, PageHeader, Panel, Td } from '@/components/dashboard/panels';
import { requireUser } from '@/server/auth/rbac';
import { listSellerOrders } from '@/server/services/order-service';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Vendas',
  robots: { index: false, follow: false },
};

export default async function SalesPage() {
  const user = await requireUser();

  if (!user.roles.includes('CREATOR') && !user.roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  // Scoped to this seller inside the service — the query can only ever return
  // line items they actually sold.
  const sales = await listSellerOrders(user.id);

  const gross = sales.reduce((sum, sale) => sum + sale.unitCents, 0);
  const net = sales.reduce((sum, sale) => sum + sale.sellerCents, 0);
  const fees = sales.reduce((sum, sale) => sum + sale.feeCents, 0);

  return (
    <>
      <PageHeader
        title="Vendas"
        description="Cada pedido pago dos seus produtos, com o valor bruto, a comissão da plataforma e o seu líquido."
      />

      <Panel
        title={`${sales.length} ${sales.length === 1 ? 'venda' : 'vendas'}`}
        description={`Bruto ${formatMoney(gross)} · Comissão ${formatMoney(fees)} · Líquido ${formatMoney(net)}`}
      >
        {sales.length === 0 ? (
          <EmptyState
            title="Nenhuma venda ainda"
            description="Assim que alguém comprar um dos seus produtos, o pedido aparece aqui."
            action={
              <LinkButton href="/dashboard/products" variant="secondary">
                Ver meus produtos
              </LinkButton>
            }
          />
        ) : (
          <DataTable
            caption="Suas vendas"
            headers={['Pedido', 'Produto', 'Cliente', 'Data', 'Bruto', 'Comissão', 'Líquido']}
            minWidth={900}
          >
            {sales.map((sale) => (
              <tr key={sale.id}>
                <Td bold>{sale.order.number}</Td>
                <Td>{sale.productName}</Td>
                <Td muted>{sale.order.buyer.name}</Td>
                <Td muted>
                  {(sale.order.paidAt ?? sale.createdAt).toLocaleDateString(
                    'pt-BR'
                  )}
                </Td>
                <Td>{formatMoney(sale.unitCents)}</Td>
                <Td muted>−{formatMoney(sale.feeCents)}</Td>
                <Td bold>{formatMoney(sale.sellerCents)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
