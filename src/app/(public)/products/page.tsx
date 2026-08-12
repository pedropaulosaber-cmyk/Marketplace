import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LinkButton } from '@/components/ui/button';
import {
  CardSkeleton,
  Container,
  EmptyState,
  ErrorState,
  SectionHeading,
} from '@/components/ui/primitives';
import { ProductCard } from '@/components/marketplace/product-card';
import { Pagination } from '@/components/marketplace/pagination';
import {
  CategoryChips,
  ClearFiltersButton,
  FilterGroup,
  SearchInput,
  SortSelect,
} from '@/components/marketplace/filter-controls';
import { listProducts } from '@/server/services/product-service';
import { getFavoriteProductIds } from '@/server/services/engagement-service';
import { getSession } from '@/server/auth/session';
import { db } from '@/server/db/client';
import { productFiltersSchema } from '@/lib/validation/schemas';
import { resilient } from '@/lib/resilient';
import { isDatabaseConfigured } from '@/lib/env';
import { demoProductFilterCounts, filterDemoProducts } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Produtos',
  description:
    'Agentes de IA, automações, workflows, prompts e templates prontos para ' +
    'usar. Filtre por categoria, preço e avaliação.',
  alternates: { canonical: '/products' },
  openGraph: {
    title: 'Produtos · AUTOMATIZE',
    description: 'Soluções de IA prontas para colocar a automação para trabalhar.',
    url: '/products',
  },
};

const SORT_OPTIONS = [
  { id: 'rel', label: 'Mais relevantes' },
  { id: 'sold', label: 'Mais vendidos' },
  { id: 'new', label: 'Mais recentes' },
  { id: 'rating', label: 'Melhor avaliados' },
  { id: 'price-l', label: 'Menor preço' },
  { id: 'price-h', label: 'Maior preço' },
] as const;

const PRICE_OPTIONS = [
  { id: 'all', label: 'Qualquer preço' },
  { id: 'free', label: 'Grátis' },
  { id: 'u100', label: 'Até R$ 99' },
  { id: '100-199', label: 'R$ 100 – 199' },
  { id: '200', label: 'R$ 200 ou mais' },
] as const;

const RATING_OPTIONS = [
  { id: 'all', label: 'Qualquer nota' },
  { id: '4.5', label: '4,5 ou mais' },
  { id: '4.7', label: '4,7 ou mais' },
  { id: '4.9', label: '4,9 ou mais' },
] as const;

const SELLER_OPTIONS = [
  { id: 'all', label: 'Todos os criadores' },
  { id: 'verified', label: 'Somente verificados' },
] as const;

const FILTER_KEYS = ['q', 'category', 'price', 'rating', 'seller'] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;

  return (
    <Container className="py-14 max-sm:py-8">
      <SectionHeading
        eyebrow="Marketplace"
        title="Soluções prontas para colocar a IA para trabalhar."
        description="Compare produtos, veja avaliações reais de quem já comprou e leve para produção hoje."
      />

      <div className="mt-10 grid grid-cols-[240px_1fr] gap-10 max-lg:grid-cols-1 max-lg:gap-6">
        <Suspense fallback={<FiltersSkeleton />}>
          <FilterSidebar />
        </Suspense>

        <div>
          <Suspense fallback={null}>
            <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
              <SearchInput
                label="Buscar produtos"
                placeholder="Buscar produtos, criadores ou integrações"
              />
              <SortSelect options={SORT_OPTIONS} />
            </div>

            <div className="mt-5">
              <CategoryChips
                categories={[
                  'Todos',
                  'AI Agents',
                  'Automações',
                  'Workflows',
                  'Prompts',
                  'Templates',
                  'Chatbots',
                ]}
              />
            </div>
          </Suspense>

          <Suspense key={JSON.stringify(raw)} fallback={<ResultsSkeleton />}>
            <Results raw={raw} />
          </Suspense>
        </div>
      </div>
    </Container>
  );
}

async function FilterSidebar() {
  // No database configured: skip the query entirely and reflect the same
  // fictional catalogue the listing below renders, rather than three counts
  // that could only ever come back as errors.
  if (!isDatabaseConfigured) {
    const counts = demoProductFilterCounts();
    return (
      <FilterSidebarView
        total={counts.total}
        free={counts.free}
        verified={counts.verified}
      />
    );
  }

  // Counts come straight from the database so the sidebar reflects the real
  // catalog rather than hard-coded numbers. A count that cannot be fetched
  // just renders the filter without a number next to it — degrading a label
  // is better than losing the whole sidebar over three optional counts.
  const { data: counts } = await resilient(
    () =>
      Promise.all([
        db.product.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
        db.product.count({
          where: { status: 'PUBLISHED', deletedAt: null, priceCents: 0 },
        }),
        db.product.count({
          where: {
            status: 'PUBLISHED',
            deletedAt: null,
            author: { professional: { verified: true } },
          },
        }),
      ]),
    [undefined, undefined, undefined] as Array<number | undefined>,
    'products.filterCounts'
  );
  const [total, free, verified] = counts;

  return <FilterSidebarView total={total} free={free} verified={verified} />;
}

function FilterSidebarView({
  total,
  free,
  verified,
}: {
  total: number | undefined;
  free: number | undefined;
  verified: number | undefined;
}) {
  return (
    <aside
      aria-label="Filtros"
      className="flex flex-col gap-7 max-lg:flex-row max-lg:flex-wrap max-lg:gap-8 max-sm:hidden"
    >
      <FilterGroup
        label="Preço"
        name="price"
        options={PRICE_OPTIONS.map((o) => ({
          ...o,
          count: o.id === 'all' ? total : o.id === 'free' ? free : undefined,
        }))}
      />
      <FilterGroup label="Avaliação" name="rating" options={RATING_OPTIONS} />
      <FilterGroup
        label="Criador"
        name="seller"
        options={SELLER_OPTIONS.map((o) => ({
          ...o,
          count: o.id === 'all' ? total : verified,
        }))}
      />
      <ClearFiltersButton keys={FILTER_KEYS} />
    </aside>
  );
}

async function Results({
  raw,
}: {
  raw: Record<string, string | string[] | undefined>;
}) {
  // Unvalidated query strings never reach the database. Anything malformed
  // falls back to the schema default instead of erroring the page.
  const parsed = productFiltersSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : productFiltersSchema.parse({});

  // No database configured: filter the fictional catalogue in memory instead
  // of querying, and skip the session/favourites lookups entirely — there is
  // no real account behind a demo page view.
  if (!isDatabaseConfigured) {
    const listing = filterDemoProducts(filters);
    return (
      <ResultsView
        raw={raw}
        items={listing.items.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          tagline: p.tagline,
          priceCents: p.priceCents,
          ratingSum: p.ratingSum,
          ratingCount: p.ratingCount,
          category: { name: p.categoryName },
          author: { name: p.authorName },
        }))}
        total={listing.total}
        page={listing.page}
        pageCount={listing.pageCount}
        favorites={new Set()}
      />
    );
  }

  const { data: listing, unavailable } = await resilient(
    () => listProducts(filters),
    { items: [], total: 0, page: 1, pageCount: 1 },
    'products.listing'
  );
  const { items, total, page, pageCount } = listing;

  const session = await getSession();
  const { data: favorites } = await resilient(
    () => (session ? getFavoriteProductIds(session.id) : Promise.resolve(new Set<string>())),
    new Set<string>(),
    'products.favorites'
  );

  if (unavailable) {
    return (
      <div className="mt-8">
        <ErrorState description="Não conseguimos carregar o catálogo agora. Tente novamente em instantes." />
      </div>
    );
  }

  return (
    <ResultsView
      raw={raw}
      items={items}
      total={total}
      page={page}
      pageCount={pageCount}
      favorites={favorites}
    />
  );
}

function ResultsView({
  raw,
  items,
  total,
  page,
  pageCount,
  favorites,
}: {
  raw: Record<string, string | string[] | undefined>;
  items: Array<{
    id: string;
    slug: string;
    name: string;
    tagline: string;
    priceCents: number;
    ratingSum: number;
    ratingCount: number;
    category: { name: string };
    author: { name: string };
  }>;
  total: number;
  page: number;
  pageCount: number;
  favorites: Set<string>;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="Nenhum produto encontrado"
          description="Tente ajustar a busca ou remover alguns filtros. Se ainda não existir o que você precisa, publique uma demanda e receba propostas."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <LinkButton href="/products" variant="secondary">
                Limpar filtros
              </LinkButton>
              <LinkButton href="/demands/new">Publicar uma demanda</LinkButton>
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
    return qs ? `/products?${qs}` : '/products';
  }

  return (
    <>
      <p
        aria-live="polite"
        className="mt-6 text-[13.5px] font-medium text-muted"
      >
        {total} {total === 1 ? 'produto encontrado' : 'produtos encontrados'}
      </p>

      <ul className="mt-4 grid grid-cols-3 gap-[14px] max-lg:grid-cols-2 max-sm:grid-cols-1">
        {items.map((product) => (
          <li key={product.id} className="contents">
            <ProductCard
              product={product}
              favorited={favorites.has(product.id)}
            />
          </li>
        ))}
      </ul>

      <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-7 max-sm:hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <span className="skeleton block h-[12px] w-[70px]" />
          <span className="skeleton block h-[16px] w-[120px]" />
          <span className="skeleton block h-[16px] w-[100px]" />
          <span className="skeleton block h-[16px] w-[110px]" />
        </div>
      ))}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-10 grid grid-cols-3 gap-[14px] max-lg:grid-cols-2 max-sm:grid-cols-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
