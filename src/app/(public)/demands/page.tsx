import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LinkButton } from '@/components/ui/button';
import {
  CardSkeleton,
  Container,
  EmptyState,
  ErrorState,
  SectionHeading,
  StatusTag,
  Tag,
} from '@/components/ui/primitives';
import { Pagination } from '@/components/marketplace/pagination';
import { listOpenDemands } from '@/server/services/demand-service';
import { formatRange } from '@/lib/money';
import { resilient } from '@/lib/resilient';

export const metadata: Metadata = {
  title: 'Demandas',
  description:
    'Empresas publicam o que precisam automatizar. Profissionais enviam ' +
    'propostas com escopo, prazo e valor.',
  alternates: { canonical: '/demands' },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Relative time in Portuguese, e.g. "há 2 dias". */
function timeAgo(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  if (days < 7) return `há ${days} dias`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'há 1 semana';
  if (weeks < 5) return `há ${weeks} semanas`;

  const months = Math.floor(days / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

export default async function DemandsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;

  return (
    <Container className="py-14 max-sm:py-8">
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-start">
        <SectionHeading
          eyebrow="Demandas"
          title="Não existe o que você precisa?"
          description="Empresas publicam o problema. Profissionais especializados respondem com escopo, prazo e valor."
        />
        <LinkButton href="/demands/new" size="lg" className="flex-none">
          Publicar demanda
        </LinkButton>
      </div>

      <Suspense key={JSON.stringify(raw)} fallback={<ListSkeleton />}>
        <DemandList raw={raw} />
      </Suspense>
    </Container>
  );
}

async function DemandList({
  raw,
}: {
  raw: Record<string, string | string[] | undefined>;
}) {
  const pageParam = typeof raw.page === 'string' ? Number(raw.page) : 1;
  const page =
    Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 500
      ? Math.floor(pageParam)
      : 1;

  const category = typeof raw.category === 'string' ? raw.category : undefined;

  const { data: listing, unavailable } = await resilient(
    () => listOpenDemands(page, category),
    { items: [], total: 0, page: 1, pageCount: 1 },
    'demands.listing'
  );
  const { items, total, pageCount } = listing;

  if (unavailable) {
    return (
      <div className="mt-10">
        <ErrorState description="Não conseguimos carregar as demandas agora. Tente novamente em instantes." />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-10">
        <EmptyState
          title="Nenhuma demanda aberta"
          description="Ainda não há demandas publicadas. Seja o primeiro a descrever o que sua empresa precisa automatizar."
          action={<LinkButton href="/demands/new">Publicar demanda</LinkButton>}
        />
      </div>
    );
  }

  function buildHref(nextPage: number): string {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `/demands?${qs}` : '/demands';
  }

  return (
    <>
      <p aria-live="polite" className="mt-10 text-[13.5px] font-medium text-muted">
        {total} {total === 1 ? 'demanda aberta' : 'demandas abertas'}
      </p>

      <ul className="mt-4 flex flex-col gap-4">
        {items.map((demand) => (
          <li
            key={demand.id}
            className="group relative flex flex-col gap-3 rounded-[14px] border border-line bg-white p-[22px] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-[3px] hover:border-blue hover:shadow-[0_12px_28px_rgb(15_23_42/0.10)]"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Tag>{demand.category}</Tag>
              <StatusTag status={demand.status} />
              <span className="text-[12.5px] text-muted">
                {timeAgo(demand.createdAt)}
              </span>
            </div>

            <h2 className="text-[20px] leading-snug font-extrabold">
              <Link
                href={`/demands/${demand.slug}`}
                className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink"
              >
                {demand.title}
              </Link>
            </h2>

            <p className="line-clamp-2 max-w-[80ch] text-[14.5px] leading-[1.6] text-muted">
              {demand.problem}
            </p>

            <div className="flex flex-wrap gap-2">
              {demand.tools.map((tool) => (
                <Tag key={tool} tone="neutral">
                  {tool}
                </Tag>
              ))}
            </div>

            <dl className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-line pt-3 text-[13px]">
              <div className="flex items-center gap-2">
                <dt className="text-muted">Orçamento</dt>
                <dd className="font-bold">
                  {formatRange(demand.budgetMinCents, demand.budgetMaxCents)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-muted">Prazo</dt>
                <dd className="font-bold">{demand.deadlineWeeks} semanas</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-muted">Propostas</dt>
                <dd className="font-bold">{demand.proposalCount}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-10 flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
