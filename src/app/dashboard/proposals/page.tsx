import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { EmptyState, StatusTag, Tag } from '@/components/ui/primitives';
import { PageHeader, Panel } from '@/components/dashboard/panels';
import { WithdrawProposalButton } from './_components/withdraw-button';
import { requireUser } from '@/server/auth/rbac';
import { listOwnProposals } from '@/server/services/demand-service';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Minhas propostas',
  robots: { index: false, follow: false },
};

export default async function ProposalsPage() {
  const user = await requireUser();

  if (!user.roles.includes('PROFESSIONAL') && !user.roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const proposals = await listOwnProposals(user.id);

  const won = proposals.filter((p) => p.status === 'ACCEPTED').length;
  const open = proposals.filter((p) => p.status === 'SENT').length;

  return (
    <>
      <PageHeader
        title="Minhas propostas"
        description="Propostas enviadas para demandas abertas e o status de cada uma."
        action={
          <LinkButton href="/demands" variant="secondary">
            Ver demandas abertas
          </LinkButton>
        }
      />

      <Panel
        title={`${proposals.length} ${proposals.length === 1 ? 'proposta' : 'propostas'}`}
        description={`${open} aguardando resposta · ${won} aceitas`}
      >
        {proposals.length === 0 ? (
          <EmptyState
            title="Nenhuma proposta enviada"
            description="Veja as demandas abertas e envie uma proposta com escopo, prazo e valor."
            action={<LinkButton href="/demands">Ver demandas abertas</LinkButton>}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="rounded-[12px] border border-line p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Tag>{proposal.demand.category}</Tag>
                  <StatusTag status={proposal.status} />
                  <span className="text-[12.5px] text-muted">
                    enviada em {proposal.createdAt.toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <h3 className="mt-3 text-[18px] font-extrabold">
                  <Link
                    href={`/demands/${proposal.demand.slug}`}
                    className="text-ink no-underline hover:text-blue-700"
                  >
                    {proposal.demand.title}
                  </Link>
                </h3>

                <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                  <div className="flex gap-2">
                    <dt className="text-muted">Seu valor</dt>
                    <dd className="font-extrabold">
                      {formatMoney(proposal.priceCents)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted">Prazo</dt>
                    <dd className="font-bold">
                      {proposal.deliveryWeeks} semanas
                    </dd>
                  </div>
                </dl>

                {proposal.status === 'SENT' ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <WithdrawProposalButton proposalId={proposal.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
