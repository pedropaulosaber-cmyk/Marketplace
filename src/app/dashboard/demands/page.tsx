import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { EmptyState, StatusTag, Tag } from '@/components/ui/primitives';
import { PageHeader, Panel } from '@/components/dashboard/panels';
import { requireUser } from '@/server/auth/rbac';
import { listOwnDemands } from '@/server/services/demand-service';
import { formatRange } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Minhas demandas',
  robots: { index: false, follow: false },
};

export default async function DashboardDemandsPage() {
  const user = await requireUser();
  const demands = await listOwnDemands(user.id);

  return (
    <>
      <PageHeader
        title="Minhas demandas"
        description="O que você publicou e as propostas recebidas."
        action={<LinkButton href="/demands/new">Publicar demanda</LinkButton>}
      />

      <Panel
        title={`${demands.length} ${demands.length === 1 ? 'demanda' : 'demandas'}`}
      >
        {demands.length === 0 ? (
          <EmptyState
            title="Nenhuma demanda publicada"
            description="Descreva o problema que você precisa resolver e receba propostas de profissionais especializados."
            action={<LinkButton href="/demands/new">Publicar demanda</LinkButton>}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {demands.map((demand) => (
              <li
                key={demand.id}
                className="relative rounded-[12px] border border-line p-5 transition-colors hover:border-blue"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Tag>{demand.category}</Tag>
                  <StatusTag status={demand.status} />
                  <span className="text-[12.5px] text-muted">
                    {demand.createdAt.toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <h3 className="mt-3 text-[18px] font-extrabold">
                  <Link
                    href={`/demands/${demand.slug}`}
                    className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink"
                  >
                    {demand.title}
                  </Link>
                </h3>

                <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                  <div className="flex gap-2">
                    <dt className="text-muted">Orçamento</dt>
                    <dd className="font-bold">
                      {formatRange(demand.budgetMinCents, demand.budgetMaxCents)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted">Prazo</dt>
                    <dd className="font-bold">{demand.deadlineWeeks} semanas</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted">Propostas</dt>
                    <dd className="font-bold text-blue-700">
                      {demand.proposalCount}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
