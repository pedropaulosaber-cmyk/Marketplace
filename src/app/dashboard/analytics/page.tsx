import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/primitives';
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
  getTopProducts,
} from '@/server/services/analytics-service';
import { averageRating } from '@/server/services/product-service';
import { formatCompactMoney, formatMoney, formatPrice } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const RANGES = [
  { id: '6', label: '6 meses' },
  { id: '12', label: '12 meses' },
  { id: '24', label: '24 meses' },
] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();

  if (!user.roles.includes('CREATOR') && !user.roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const rangeParam = typeof params.range === 'string' ? params.range : '12';
  const months = RANGES.some((r) => r.id === rangeParam)
    ? Number(rangeParam)
    : 12;

  const [kpis, series, top] = await Promise.all([
    getSellerKpis(user.id),
    getRevenueSeries(user.id, months),
    getTopProducts(user.id, 8),
  ]);

  const hasSales = series.some((point) => point.cents > 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Receita, pedidos e desempenho por produto."
      />

      <KpiGrid>
        <Kpi
          label="Receita líquida"
          value={formatCompactMoney(kpis.revenueCents)}
          delta="já descontada a comissão"
        />
        <Kpi label="Pedidos" value={String(kpis.orders)} />
        <Kpi label="Clientes" value={String(kpis.customers)} />
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
        title="Receita"
        action={
          <div className="flex gap-2">
            {RANGES.map((range) => (
              <Link
                key={range.id}
                href={`/dashboard/analytics?range=${range.id}`}
                aria-current={String(months) === range.id ? 'true' : undefined}
                className={
                  String(months) === range.id
                    ? 'rounded-[8px] bg-blue px-[15px] py-[9px] text-[13.5px] font-semibold text-white no-underline hover:text-white'
                    : 'rounded-[8px] border border-line bg-white px-[15px] py-[9px] text-[13.5px] font-semibold text-ink no-underline hover:border-blue hover:text-blue-700'
                }
              >
                {range.label}
              </Link>
            ))}
          </div>
        }
      >
        {hasSales ? (
          <RevenueChart points={series} formatValue={formatCompactMoney} />
        ) : (
          <EmptyState
            title="Ainda sem dados de receita"
            description="O gráfico se preenche a partir da sua primeira venda paga."
          />
        )}
      </Panel>

      <Panel title="Produtos com melhor desempenho">
        {top.length === 0 ? (
          <EmptyState
            title="Nenhum produto publicado"
            description="Publique um produto para começar a acompanhar o desempenho."
          />
        ) : (
          <DataTable
            caption="Produtos por vendas"
            headers={['Produto', 'Categoria', 'Preço', 'Vendas', 'Receita bruta', 'Nota']}
          >
            {top.map((product) => {
              const rating = averageRating(
                product.ratingSum,
                product.ratingCount
              );

              return (
                <tr key={product.id}>
                  <Td bold>{product.name}</Td>
                  <Td muted>{product.category.name}</Td>
                  <Td>{formatPrice(product.priceCents)}</Td>
                  <Td>{product.salesCount}</Td>
                  <Td bold>
                    {formatMoney(product.salesCount * product.priceCents)}
                  </Td>
                  <Td muted>{rating ?? '—'}</Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
