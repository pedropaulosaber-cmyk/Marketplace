import type { Metadata } from 'next';
import { EmptyState, StatusTag } from '@/components/ui/primitives';
import {
  DataTable,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  Td,
} from '@/components/dashboard/panels';
import { listTransactions } from '@/server/services/admin-service';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Transações',
  robots: { index: false, follow: false },
};

export default async function TransactionsPage() {
  const orders = await listTransactions();

  const gross = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + o.totalCents, 0);

  const fees = orders
    .filter((o) => o.status === 'PAID')
    .reduce((sum, o) => sum + o.feeCents, 0);

  const refunded = orders.filter((o) => o.status === 'REFUNDED').length;

  return (
    <>
      <PageHeader
        title="Transações"
        description="Pedidos pagos e reembolsados, com a comissão retida pela plataforma."
      />

      <KpiGrid>
        <Kpi label="Volume bruto" value={formatMoney(gross)} />
        <Kpi label="Comissão da plataforma" value={formatMoney(fees)} tone="up" />
        <Kpi label="Pedidos pagos" value={String(orders.length - refunded)} />
        <Kpi
          label="Reembolsos"
          value={String(refunded)}
          tone={refunded > 0 ? 'down' : 'neutral'}
        />
      </KpiGrid>

      <Panel title="Histórico">
        {orders.length === 0 ? (
          <EmptyState
            title="Nenhuma transação"
            description="As transações aparecem aqui após a primeira compra confirmada."
          />
        ) : (
          <DataTable
            caption="Transações"
            headers={['Pedido', 'Comprador', 'Produtos', 'Total', 'Comissão', 'Provedor', 'Status', 'Data']}
            minWidth={1060}
          >
            {orders.map((order) => (
              <tr key={order.id}>
                <Td bold>{order.number}</Td>
                <Td muted>{order.buyer.name}</Td>
                <Td>{order.items.map((i) => i.productName).join(', ')}</Td>
                <Td bold>{formatMoney(order.totalCents)}</Td>
                <Td>{formatMoney(order.feeCents)}</Td>
                <Td muted>{order.payment?.provider ?? '—'}</Td>
                <Td>
                  <StatusTag status={order.status} />
                </Td>
                <Td muted>
                  {order.paidAt ? order.paidAt.toLocaleDateString('pt-BR') : '—'}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
