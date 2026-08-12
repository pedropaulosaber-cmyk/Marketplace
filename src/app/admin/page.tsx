import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import {
  DataTable,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  Td,
} from '@/components/dashboard/panels';
import {
  getPlatformStats,
  listModerationQueue,
} from '@/server/services/admin-service';
import { formatMoney, formatPrice } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Administração',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const [stats, queue] = await Promise.all([
    getPlatformStats(),
    listModerationQueue(),
  ]);

  return (
    <>
      <PageHeader
        title="Visão geral da plataforma"
        description="Números agregados e o que precisa de atenção agora."
      />

      <KpiGrid>
        <Kpi label="Usuários" value={String(stats.users)} />
        <Kpi label="Produtos publicados" value={String(stats.products)} />
        <Kpi
          label="Aguardando revisão"
          value={String(stats.pendingReview)}
          delta={stats.pendingReview > 0 ? 'requer ação' : 'fila vazia'}
          tone={stats.pendingReview > 0 ? 'down' : 'up'}
        />
        <Kpi
          label="Receita da plataforma"
          value={formatMoney(stats.platformRevenueCents)}
          delta={`${stats.orders} pedidos pagos`}
        />
      </KpiGrid>

      <KpiGrid>
        <Kpi label="Demandas abertas" value={String(stats.openDemands)} />
        <Kpi label="Propostas em aberto" value={String(stats.openProposals)} />
      </KpiGrid>

      <Panel
        title="Fila de moderação"
        description="Produtos aguardando aprovação, do mais antigo para o mais recente."
        action={
          <Link href="/admin/moderation" className="text-[13px] font-semibold">
            Abrir fila
          </Link>
        }
      >
        {queue.length === 0 ? (
          <EmptyState
            title="Fila vazia"
            description="Nenhum produto aguardando revisão no momento."
            action={
              <LinkButton href="/admin/products" variant="secondary">
                Ver todos os produtos
              </LinkButton>
            }
          />
        ) : (
          <DataTable
            caption="Produtos aguardando revisão"
            headers={['Produto', 'Criador', 'Categoria', 'Preço', 'Arquivos', 'Enviado em']}
          >
            {queue.slice(0, 8).map((product) => (
              <tr key={product.id}>
                <Td bold>
                  <Link
                    href="/admin/moderation"
                    className="text-ink no-underline hover:text-blue-700"
                  >
                    {product.name}
                  </Link>
                </Td>
                <Td muted>{product.author.name}</Td>
                <Td muted>{product.category.name}</Td>
                <Td>{formatPrice(product.priceCents)}</Td>
                <Td>{product._count.files}</Td>
                <Td muted>
                  {product.submittedAt
                    ? product.submittedAt.toLocaleDateString('pt-BR')
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
