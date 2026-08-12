import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, StatusTag } from '@/components/ui/primitives';
import { DataTable, PageHeader, Panel, Td } from '@/components/dashboard/panels';
import { listAdminDemands } from '@/server/services/admin-service';
import { formatRange } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Demandas',
  robots: { index: false, follow: false },
};

export default async function AdminDemandsPage() {
  const demands = await listAdminDemands();

  return (
    <>
      <PageHeader
        title="Demandas"
        description="Tudo o que foi publicado no marketplace de demandas."
      />

      <Panel
        title={`${demands.length} ${demands.length === 1 ? 'demanda' : 'demandas'}`}
      >
        {demands.length === 0 ? (
          <EmptyState
            title="Nenhuma demanda"
            description="Nada publicado ainda."
          />
        ) : (
          <DataTable
            caption="Demandas da plataforma"
            headers={['Título', 'Cliente', 'Categoria', 'Orçamento', 'Propostas', 'Status', 'Data']}
            minWidth={980}
          >
            {demands.map((demand) => (
              <tr key={demand.id}>
                <Td bold>
                  <Link
                    href={`/demands/${demand.slug}`}
                    className="text-ink no-underline hover:text-blue-700"
                  >
                    {demand.title}
                  </Link>
                </Td>
                <Td muted>{demand.buyer.name}</Td>
                <Td muted>{demand.category}</Td>
                <Td>
                  {formatRange(demand.budgetMinCents, demand.budgetMaxCents)}
                </Td>
                <Td>{demand.proposalCount}</Td>
                <Td>
                  <StatusTag status={demand.status} />
                </Td>
                <Td muted>{demand.createdAt.toLocaleDateString('pt-BR')}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
