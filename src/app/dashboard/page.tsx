import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { EmptyState, StatusTag, Tag } from '@/components/ui/primitives';
import {
  DataTable,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  RevenueChart,
  Td,
} from '@/components/dashboard/panels';
import { requireUser } from '@/server/auth/rbac';
import {
  getRevenueSeries,
  getSellerKpis,
} from '@/server/services/analytics-service';
import { listOwnProducts } from '@/server/services/product-service';
import { listOwnDemands, listOwnProposals } from '@/server/services/demand-service';
import { listLibrary } from '@/server/services/order-service';
import { listNotifications } from '@/server/services/engagement-service';
import { formatCompactMoney, formatMoney, formatPrice } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Visão geral',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await requireUser();

  const isCreator = user.roles.includes('CREATOR');
  const isProfessional = user.roles.includes('PROFESSIONAL');

  const [kpis, series, products, demands, proposals, library, notifications] =
    await Promise.all([
      isCreator ? getSellerKpis(user.id) : Promise.resolve(null),
      isCreator ? getRevenueSeries(user.id, 12) : Promise.resolve([]),
      isCreator ? listOwnProducts(user) : Promise.resolve([]),
      listOwnDemands(user.id),
      isProfessional ? listOwnProposals(user.id) : Promise.resolve([]),
      listLibrary(user.id),
      listNotifications(user.id, 6),
    ]);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(' ')[0]}`}
        description="Um resumo do que está acontecendo com a sua conta."
        action={
          isCreator ? (
            <LinkButton href="/dashboard/products/new">Novo produto</LinkButton>
          ) : (
            <LinkButton href="/demands/new">Publicar demanda</LinkButton>
          )
        }
      />

      {kpis ? (
        <>
          <KpiGrid>
            <Kpi
              label="Receita"
              value={formatCompactMoney(kpis.revenueCents)}
              delta={`${formatMoney(kpis.pendingPayoutCents)} a repassar`}
              tone="up"
            />
            <Kpi label="Pedidos" value={String(kpis.orders)} />
            <Kpi
              label="Produtos"
              value={String(kpis.products)}
              delta={
                kpis.productsInReview > 0
                  ? `${kpis.productsInReview} em revisão`
                  : 'todos publicados'
              }
              tone={kpis.productsInReview > 0 ? 'down' : 'neutral'}
            />
            <Kpi
              label="Nota média"
              value={
                kpis.averageRating
                  ? kpis.averageRating.toFixed(1).replace('.', ',')
                  : '—'
              }
              delta={`${kpis.reviews} avaliações`}
            />
          </KpiGrid>

          <Panel
            title="Receita nos últimos 12 meses"
            description="Valores líquidos, já descontada a comissão da plataforma."
          >
            <RevenueChart points={series} formatValue={formatCompactMoney} />
          </Panel>

          <Panel
            title="Seus produtos"
            action={
              <Link href="/dashboard/products" className="text-[13px] font-semibold">
                Ver todos
              </Link>
            }
          >
            {products.length === 0 ? (
              <EmptyState
                title="Nenhum produto ainda"
                description="Publique sua primeira solução e comece a vender. A revisão leva até 3 dias úteis."
                action={
                  <LinkButton href="/dashboard/products/new">
                    Criar produto
                  </LinkButton>
                }
              />
            ) : (
              <DataTable
                caption="Seus produtos"
                headers={['Produto', 'Categoria', 'Preço', 'Vendas', 'Status']}
              >
                {products.slice(0, 6).map((product) => (
                  <tr key={product.id}>
                    <Td bold>{product.name}</Td>
                    <Td muted>{product.category.name}</Td>
                    <Td>{formatPrice(product.priceCents)}</Td>
                    <Td>{product.salesCount}</Td>
                    <Td>
                      <StatusTag status={product.status} />
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
        </>
      ) : (
        <KpiGrid>
          <Kpi label="Produtos na biblioteca" value={String(library.length)} />
          <Kpi label="Demandas publicadas" value={String(demands.length)} />
          <Kpi
            label="Propostas recebidas"
            value={String(demands.reduce((sum, d) => sum + d.proposalCount, 0))}
          />
          <Kpi
            label="Notificações"
            value={String(notifications.filter((n) => !n.readAt).length)}
          />
        </KpiGrid>
      )}

      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        <Panel
          title="Suas demandas"
          action={
            <Link href="/dashboard/demands" className="text-[13px] font-semibold">
              Ver todas
            </Link>
          }
        >
          {demands.length === 0 ? (
            <EmptyState
              title="Nenhuma demanda publicada"
              description="Descreva o que você precisa automatizar e receba propostas de especialistas."
              action={<LinkButton href="/demands/new">Publicar demanda</LinkButton>}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {demands.slice(0, 4).map((demand) => (
                <li
                  key={demand.id}
                  className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/demands/${demand.slug}`}
                      className="text-[14px] font-bold text-ink no-underline hover:text-blue-700"
                    >
                      {demand.title}
                    </Link>
                    <p className="mt-1 text-[12.5px] text-muted">
                      {demand.proposalCount}{' '}
                      {demand.proposalCount === 1 ? 'proposta' : 'propostas'}
                    </p>
                  </div>
                  <StatusTag status={demand.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {isProfessional ? (
          <Panel
            title="Suas propostas"
            action={
              <Link
                href="/dashboard/proposals"
                className="text-[13px] font-semibold"
              >
                Ver todas
              </Link>
            }
          >
            {proposals.length === 0 ? (
              <EmptyState
                title="Nenhuma proposta enviada"
                description="Veja as demandas abertas e envie sua primeira proposta."
                action={
                  <LinkButton href="/demands" variant="secondary">
                    Ver demandas abertas
                  </LinkButton>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {proposals.slice(0, 4).map((proposal) => (
                  <li
                    key={proposal.id}
                    className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/demands/${proposal.demand.slug}`}
                        className="text-[14px] font-bold text-ink no-underline hover:text-blue-700"
                      >
                        {proposal.demand.title}
                      </Link>
                      <p className="mt-1 text-[12.5px] text-muted">
                        {formatMoney(proposal.priceCents)} ·{' '}
                        {proposal.deliveryWeeks} semanas
                      </p>
                    </div>
                    <StatusTag status={proposal.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <Panel title="Novidades">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-muted">
                Nada por aqui ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
                  >
                    {!notification.readAt ? (
                      <Tag>Nova</Tag>
                    ) : (
                      <Tag tone="neutral">Lida</Tag>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold">
                        {notification.title}
                      </p>
                      <p className="mt-[2px] text-[12.5px] text-muted">
                        {notification.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
