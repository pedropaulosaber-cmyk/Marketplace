import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LinkButton } from '@/components/ui/button';
import {
  Avatar,
  CardSkeleton,
  Container,
  EmptyState,
  ErrorState,
  SectionHeading,
  Tag,
} from '@/components/ui/primitives';
import { Pagination } from '@/components/marketplace/pagination';
import {
  CategoryChips,
  ClearFiltersButton,
  FilterGroup,
  SearchInput,
  SortSelect,
} from '@/components/marketplace/filter-controls';
import {
  listProfessionals,
  getProfessionalFacets,
  ratingLabel,
} from '@/server/services/professional-service';
import { professionalFiltersSchema } from '@/lib/validation/schemas';
import { formatRange } from '@/lib/money';
import { resilient } from '@/lib/resilient';
import { isDatabaseConfigured } from '@/lib/env';
import {
  DEMO_PROFESSIONAL_FIELDS,
  filterDemoProfessionals,
  type DemoProfessional,
} from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Profissionais',
  description:
    'Especialistas em automação e IA com portfólio, histórico de entregas e ' +
    'avaliações públicas. Encontre quem pode construir sua próxima automação.',
  alternates: { canonical: '/professionals' },
};

const SORT_OPTIONS = [
  { id: 'rel', label: 'Mais relevantes' },
  { id: 'rating', label: 'Melhor avaliados' },
  { id: 'projects', label: 'Mais projetos' },
  { id: 'avail', label: 'Disponíveis primeiro' },
] as const;

const AVAIL_OPTIONS = [
  { id: 'all', label: 'Qualquer disponibilidade' },
  { id: 'now', label: 'Disponível agora' },
  { id: 'soon', label: 'A partir do próximo mês' },
  { id: 'full', label: 'Agenda cheia' },
] as const;

const TIER_OPTIONS = [
  { id: 'all', label: 'Qualquer faixa' },
  { id: 'low', label: 'Até R$ 9 mil' },
  { id: 'mid', label: 'R$ 2 – 12 mil' },
  { id: 'high', label: 'R$ 5 mil ou mais' },
] as const;

const RATING_OPTIONS = [
  { id: 'all', label: 'Qualquer nota' },
  { id: '4.7', label: '4,7 ou mais' },
  { id: '4.9', label: '4,9 ou mais' },
] as const;

const SKILLS = [
  'Todas',
  'n8n',
  'Make',
  'WhatsApp',
  'OpenAI',
  'APIs',
  'Python',
  'HubSpot',
  'Shopify',
  'CRM',
  'Dados',
  'Chatbots',
] as const;

const HIRE_STEPS = [
  {
    n: '01',
    t: 'Escolha ou publique',
    b: 'Contrate direto pelo perfil ou publique a demanda e receba propostas.',
  },
  {
    n: '02',
    t: 'Combine o escopo',
    b: 'Escopo, prazo e preço ficam registrados na plataforma antes de começar.',
  },
  {
    n: '03',
    t: 'Pagamento retido',
    b: 'O valor fica retido e só é liberado quando você aprova a entrega.',
  },
  {
    n: '04',
    t: 'Avalie',
    b: 'Sua avaliação entra no histórico público do profissional.',
  },
] as const;

const AVAILABILITY_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> =
  {
    NOW: { label: 'Disponível agora', tone: 'ok' },
    SOON: { label: 'A partir do próximo mês', tone: 'warn' },
    FULL: { label: 'Agenda cheia', tone: 'neutral' },
  };

const FILTER_KEYS = ['q', 'field', 'skill', 'avail', 'tier', 'rating'] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;

  return (
    <Container className="py-14 max-sm:py-8">
      <SectionHeading
        eyebrow="Contratar"
        title="Encontre quem pode construir sua próxima automação."
        description="Profissionais com portfólio verificado, histórico de entregas e avaliações de clientes reais."
      />

      <div className="mt-10 grid grid-cols-[240px_1fr] gap-10 max-lg:grid-cols-1 max-lg:gap-6">
        <Suspense fallback={null}>
          <ProfessionalFilters />
        </Suspense>

        <div>
          <Suspense fallback={null}>
            <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
              <SearchInput
                label="Buscar profissionais"
                placeholder="Buscar por nome, especialidade ou ferramenta"
              />
              <SortSelect options={SORT_OPTIONS} />
            </div>

            <div className="mt-5">
              <CategoryChips categories={SKILLS} paramName="skill" />
            </div>
          </Suspense>

          <Suspense key={JSON.stringify(raw)} fallback={<ResultsSkeleton />}>
            <Results raw={raw} />
          </Suspense>
        </div>
      </div>

      <section className="mt-24 rounded-[20px] border border-line bg-bg p-12 max-sm:mt-14 max-sm:p-6">
        <h2 className="text-[30px] font-extrabold max-sm:text-[22px]">
          Como a contratação funciona
        </h2>
        <ol className="mt-8 grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {HIRE_STEPS.map((step) => (
            <li key={step.n}>
              <span className="text-[13px] font-extrabold text-blue">
                {step.n}
              </span>
              <p className="mt-2 text-[17px] font-bold">{step.t}</p>
              <p className="mt-1 text-[14px] leading-[1.6] text-muted">
                {step.b}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <LinkButton href="/demands/new">Publicar uma demanda</LinkButton>
        </div>
      </section>
    </Container>
  );
}

async function ProfessionalFilters() {
  const facets = isDatabaseConfigured
    ? (await resilient(getProfessionalFacets, [], 'professionals.facets')).data
    : DEMO_PROFESSIONAL_FIELDS;

  const fieldOptions = [
    { id: 'Todas as áreas', label: 'Todas as áreas' },
    ...facets.map((f) => ({ id: f.field, label: f.field, count: f.count })),
  ];

  return (
    <aside
      aria-label="Filtros"
      className="flex flex-col gap-7 max-lg:flex-row max-lg:flex-wrap max-lg:gap-8 max-sm:hidden"
    >
      <FilterGroup label="Área de atuação" name="field" options={fieldOptions} />
      <FilterGroup label="Disponibilidade" name="avail" options={AVAIL_OPTIONS} />
      <FilterGroup label="Faixa de projeto" name="tier" options={TIER_OPTIONS} />
      <FilterGroup label="Avaliação" name="rating" options={RATING_OPTIONS} />
      <ClearFiltersButton keys={FILTER_KEYS} />
    </aside>
  );
}

async function Results({
  raw,
}: {
  raw: Record<string, string | string[] | undefined>;
}) {
  const parsed = professionalFiltersSchema.safeParse(raw);
  const filters = parsed.success
    ? parsed.data
    : professionalFiltersSchema.parse({});

  // No database configured: filter the fictional roster in memory instead of
  // querying.
  if (!isDatabaseConfigured) {
    const listing = filterDemoProfessionals(filters);
    return (
      <ResultsView
        raw={raw}
        items={listing.items.map(demoToCard)}
        total={listing.total}
        page={listing.page}
        pageCount={listing.pageCount}
      />
    );
  }

  const { data: listing, unavailable } = await resilient(
    () => listProfessionals(filters),
    { items: [], total: 0, page: 1, pageCount: 1 },
    'professionals.listing'
  );
  const { items, total, page, pageCount } = listing;

  if (unavailable) {
    return (
      <div className="mt-8">
        <ErrorState description="Não conseguimos carregar os profissionais agora. Tente novamente em instantes." />
      </div>
    );
  }

  return (
    <ResultsView raw={raw} items={items} total={total} page={page} pageCount={pageCount} />
  );
}

/** Reshapes a demo professional into the same fields the real card reads. */
function demoToCard(pro: DemoProfessional) {
  return {
    id: pro.id,
    slug: pro.slug,
    verified: pro.verified,
    title: pro.title,
    location: pro.location,
    bio: pro.bio,
    skills: pro.skills,
    availability: pro.availability,
    ratingSum: pro.ratingSum,
    ratingCount: pro.ratingCount,
    projectsCount: pro.projectsCount,
    rateMinCents: pro.rateMinCents,
    rateMaxCents: pro.rateMaxCents,
    user: { name: pro.name },
  };
}

function ResultsView({
  raw,
  items,
  total,
  page,
  pageCount,
}: {
  raw: Record<string, string | string[] | undefined>;
  items: ReturnType<typeof demoToCard>[];
  total: number;
  page: number;
  pageCount: number;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="Nenhum profissional encontrado"
          description="Tente ampliar os filtros, ou publique sua demanda — especialistas de várias áreas acompanham as demandas abertas."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <LinkButton href="/professionals" variant="secondary">
                Limpar filtros
              </LinkButton>
              <LinkButton href="/demands/new">Publicar demanda</LinkButton>
            </div>
          }
        />
      </div>
    );
  }

  function buildHref(nextPage: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && key !== 'page') params.set(key, value);
    }
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `/professionals?${qs}` : '/professionals';
  }

  return (
    <>
      <p aria-live="polite" className="mt-6 text-[13.5px] font-medium text-muted">
        {total}{' '}
        {total === 1
          ? 'profissional encontrado'
          : 'profissionais encontrados'}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        {items.map((pro) => {
          const availability =
            AVAILABILITY_LABEL[pro.availability] ?? AVAILABILITY_LABEL.NOW!;
          const rating = ratingLabel(pro.ratingSum, pro.ratingCount);

          return (
            <li
              key={pro.id}
              className="group relative flex flex-col gap-3 rounded-[14px] border border-line bg-white p-[22px] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-[3px] hover:border-blue hover:shadow-[0_12px_28px_rgb(15_23_42/0.10)]"
            >
              <div className="flex items-start gap-3">
                <Avatar name={pro.user.name} size={44} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-extrabold">
                      <Link
                        href={`/professionals/${pro.slug}`}
                        className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink"
                      >
                        {pro.user.name}
                      </Link>
                    </h3>
                    {pro.verified ? <Tag tone="ok">Verificado</Tag> : null}
                  </div>
                  <p className="text-[13.5px] font-semibold text-blue-700">
                    {pro.title}
                  </p>
                  <p className="mt-[2px] text-[12.5px] text-muted">
                    {pro.location}
                  </p>
                </div>
              </div>

              <p className="line-clamp-3 flex-1 text-[14px] leading-[1.6] text-muted">
                {pro.bio}
              </p>

              <div className="flex flex-wrap gap-[6px]">
                {pro.skills.slice(0, 4).map((skill) => (
                  <Tag key={skill} tone="neutral">
                    {skill}
                  </Tag>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="flex items-center gap-3 text-[12.5px]">
                  {rating ? (
                    <span className="flex items-center gap-1">
                      <span aria-hidden="true" className="text-star">
                        ★
                      </span>
                      <span className="font-bold">{rating}</span>
                    </span>
                  ) : null}
                  <span className="text-muted">
                    {pro.projectsCount} projetos
                  </span>
                  <Tag tone={availability.tone}>{availability.label}</Tag>
                </div>
                <span className="text-[13px] font-bold">
                  {pro.rateMaxCents > 0
                    ? formatRange(pro.rateMinCents, pro.rateMaxCents)
                    : 'Sob consulta'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-10 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
