import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Avatar,
  Container,
  EmptyState,
  StatusTag,
  Tag,
} from '@/components/ui/primitives';
import { getDemand } from '@/server/services/demand-service';
import { getSession } from '@/server/auth/session';
import { db } from '@/server/db/client';
import { isAppError } from '@/lib/errors';
import { formatMoney, formatRange } from '@/lib/money';
import { ProposalForm } from './_components/proposal-form';
import { ProposalDecision } from './_components/proposal-decision';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  const demand = await db.demand.findFirst({
    where: { OR: [{ id }, { slug: id }], deletedAt: null },
    select: { title: true, problem: true, slug: true },
  });

  if (!demand) {
    return { title: 'Demanda não encontrada', robots: { index: false } };
  }

  return {
    title: demand.title,
    description: demand.problem.slice(0, 160),
    alternates: { canonical: `/demands/${demand.slug}` },
  };
}

export default async function DemandPage({ params }: PageProps) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getDemand>>;
  try {
    data = await getDemand(id);
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const { demand, proposals, isOwner, canSeeAllProposals } = data;
  const session = await getSession();

  // Whether this viewer may submit a proposal: a professional, not the owner,
  // hasn't already proposed, and the demand is still open. The action
  // re-verifies every one of these — this only decides what to render.
  const professional = session
    ? await db.professionalProfile.findUnique({
        where: { userId: session.id },
        select: { id: true },
      })
    : null;

  const alreadyProposed = proposals.some((p) => p.authorId === session?.id);
  const canPropose =
    Boolean(professional) &&
    !isOwner &&
    !alreadyProposed &&
    (demand.status === 'OPEN' || demand.status === 'IN_REVIEW');

  return (
    <Container className="py-12 max-sm:py-6">
      <nav aria-label="Trilha de navegação">
        <ol className="flex items-center gap-2 text-[13px] text-muted">
          <li>
            <Link href="/demands" className="no-underline hover:text-blue-700">
              Demandas
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-ink">
            {demand.title}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid grid-cols-[1fr_320px] gap-12 max-lg:grid-cols-1 max-lg:gap-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Tag>{demand.category}</Tag>
            <StatusTag status={demand.status} />
          </div>

          <h1 className="mt-4 text-[36px] leading-[1.1] font-extrabold max-sm:text-[26px]">
            {demand.title}
          </h1>

          <div className="mt-5 flex items-center gap-3">
            <Avatar name={demand.buyer.name} size={38} />
            <div>
              <p className="text-[14px] font-bold">
                {demand.buyer.profile?.company ?? demand.buyer.name}
              </p>
              <p className="text-[12.5px] text-muted">
                Publicada por {demand.buyer.name}
              </p>
            </div>
          </div>

          <Section title="O problema">{demand.problem}</Section>
          <Section title="O objetivo">{demand.goal}</Section>
          <Section title="Contexto e detalhes">{demand.details}</Section>

          {demand.tools.length > 0 ? (
            <section className="mt-9">
              <h2 className="text-[20px] font-extrabold">Ferramentas</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {demand.tools.map((tool) => (
                  <Tag key={tool} tone="neutral">
                    {tool}
                  </Tag>
                ))}
              </div>
            </section>
          ) : null}

          {/* --- Proposals --- */}
          <section className="mt-12">
            <h2 className="text-[24px] font-extrabold">
              {canSeeAllProposals
                ? `${demand.proposalCount} ${demand.proposalCount === 1 ? 'proposta recebida' : 'propostas recebidas'}`
                : 'Sua proposta'}
            </h2>

            {!canSeeAllProposals && session ? (
              <p className="mt-2 text-[13.5px] text-muted">
                Propostas de outros profissionais ficam visíveis apenas para
                quem publicou a demanda.
              </p>
            ) : null}

            {proposals.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title={
                    isOwner
                      ? 'Nenhuma proposta ainda'
                      : 'Você ainda não enviou proposta'
                  }
                  description={
                    isOwner
                      ? 'Assim que um profissional responder, a proposta aparece aqui com valor, prazo e escopo.'
                      : 'Envie uma proposta com escopo, prazo e valor para concorrer a esta demanda.'
                  }
                />
              </div>
            ) : (
              <ul className="mt-5 flex flex-col gap-4">
                {proposals.map((proposal) => (
                  <li
                    key={proposal.id}
                    className="rounded-[14px] border border-line bg-white p-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar name={proposal.professional.user.name} size={36} />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/professionals/${proposal.professional.slug}`}
                            className="text-[15px] font-bold text-ink no-underline hover:text-blue-700"
                          >
                            {proposal.professional.user.name}
                          </Link>
                          {proposal.professional.verified ? (
                            <Tag tone="ok">Verificado</Tag>
                          ) : null}
                        </div>
                        <p className="text-[12.5px] text-muted">
                          {proposal.professional.projectsCount} projetos
                          entregues
                        </p>
                      </div>
                      <StatusTag status={proposal.status} />
                    </div>

                    <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[13.5px]">
                      <div className="flex items-center gap-2">
                        <dt className="text-muted">Valor</dt>
                        <dd className="font-extrabold">
                          {formatMoney(proposal.priceCents)}
                        </dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <dt className="text-muted">Prazo</dt>
                        <dd className="font-bold">
                          {proposal.deliveryWeeks} semanas
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-4 text-[14.5px] leading-[1.65]">
                      {proposal.approach}
                    </p>

                    {proposal.deliverables.length > 0 ? (
                      <ul className="mt-4 flex flex-col gap-2">
                        {proposal.deliverables.map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-[13.5px] text-[#334155]"
                          >
                            <span aria-hidden="true" className="text-blue">
                              ✓
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {isOwner && proposal.status === 'SENT' ? (
                      <ProposalDecision proposalId={proposal.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canPropose ? (
            <section className="mt-12">
              <h2 className="text-[24px] font-extrabold">Enviar proposta</h2>
              <ProposalForm demandId={demand.id} />
            </section>
          ) : null}
        </div>

        {/* --- Summary panel --- */}
        <aside className="max-lg:order-first">
          <div className="sticky top-[100px] rounded-[14px] border border-line bg-white p-6">
            <dl className="flex flex-col gap-4 text-[13.5px]">
              <div>
                <dt className="text-muted">Orçamento</dt>
                <dd className="mt-1 text-[19px] font-extrabold">
                  {formatRange(demand.budgetMinCents, demand.budgetMaxCents)}
                </dd>
              </div>
              <div className="border-t border-line pt-4">
                <dt className="text-muted">Prazo desejado</dt>
                <dd className="mt-1 font-bold">
                  {demand.deadlineWeeks} semanas
                </dd>
              </div>
              <div className="border-t border-line pt-4">
                <dt className="text-muted">Propostas recebidas</dt>
                <dd className="mt-1 font-bold">{demand.proposalCount}</dd>
              </div>
              <div className="border-t border-line pt-4">
                <dt className="text-muted">Publicada em</dt>
                <dd className="mt-1 font-bold">
                  {demand.createdAt.toLocaleDateString('pt-BR')}
                </dd>
              </div>
            </dl>

            {!session ? (
              <p className="mt-6 border-t border-line pt-5 text-[13px] leading-[1.5] text-muted">
                <Link href="/login" className="font-semibold">
                  Entre
                </Link>{' '}
                como profissional para enviar uma proposta.
              </p>
            ) : alreadyProposed ? (
              <p className="mt-6 border-t border-line pt-5 text-[13px] leading-[1.5] text-muted">
                Você já enviou uma proposta para esta demanda.
              </p>
            ) : !professional && !isOwner ? (
              <p className="mt-6 border-t border-line pt-5 text-[13px] leading-[1.5] text-muted">
                Apenas profissionais podem enviar propostas.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </Container>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="text-[20px] font-extrabold">{title}</h2>
      <p className="mt-3 max-w-[70ch] text-[15.5px] leading-[1.7] whitespace-pre-line text-[#334155]">
        {children}
      </p>
    </section>
  );
}
