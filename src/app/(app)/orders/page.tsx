import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import {
  Container,
  EmptyState,
  SectionHeading,
  StatusTag,
} from '@/components/ui/primitives';
import { listOwnOrders } from '@/server/services/order-service';
import { requireUser } from '@/server/auth/rbac';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Meus pedidos',
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await listOwnOrders(user.id);

  return (
    <Container className="py-14 max-sm:py-8">
      <SectionHeading
        eyebrow="Pedidos"
        title="Histórico de compras."
        description="Acompanhe o status de cada pedido e acesse os produtos liberados."
      />

      {orders.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nenhum pedido ainda"
            description="Quando você comprar um produto, o pedido aparece aqui com o status do pagamento."
            action={<LinkButton href="/products">Explorar produtos</LinkButton>}
          />
        </div>
      ) : (
        <div className="mt-10 overflow-x-auto rounded-[14px] border border-line">
          <table className="w-full min-w-[680px] border-collapse bg-white">
            <caption className="sr-only">Seus pedidos</caption>
            <thead>
              <tr>
                {['Pedido', 'Produtos', 'Data', 'Total', 'Status'].map(
                  (header) => (
                    <th
                      key={header}
                      scope="col"
                      className="border-b border-line px-[14px] py-[10px] text-left text-[11.5px] font-extrabold tracking-[0.1em] text-muted uppercase"
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="border-b border-line p-[14px] text-[13.5px] font-bold">
                    {order.number}
                  </td>
                  <td className="border-b border-line p-[14px] text-[13.5px]">
                    {order.items.map((item) => item.productName).join(', ')}
                  </td>
                  <td className="border-b border-line p-[14px] text-[13.5px] text-muted">
                    {(order.paidAt ?? order.placedAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="border-b border-line p-[14px] text-[13.5px] font-bold">
                    {formatMoney(order.totalCents)}
                  </td>
                  <td className="border-b border-line p-[14px]">
                    <StatusTag status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
