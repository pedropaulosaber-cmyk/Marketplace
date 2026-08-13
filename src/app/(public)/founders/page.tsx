import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, Container, EmptyState, ErrorState, SectionHeading, Tag } from '@/components/ui/primitives';
import { listFoundingCreators } from '@/server/services/creator-service';
import { formatPrice } from '@/lib/money';
import { resilient } from '@/lib/resilient';
import { isDatabaseConfigured } from '@/lib/env';
import { demoFounderProducts, listDemoFounders } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Criadores fundadores',
  description:
    'Os criadores que integraram a Automatize desde o início — quem construiu os primeiros produtos do catálogo.',
  alternates: { canonical: '/founders' },
};

export const dynamic = 'force-dynamic';

interface FounderCardData {
  id: string;
  slug: string;
  name: string;
  headline: string;
  bio: string;
  products: {
    id: string;
    slug: string;
    name: string;
    priceCents: number;
    categoryName: string;
  }[];
}

export default async function FoundersPage() {
  const founders = isDatabaseConfigured
    ? await loadRealFounders()
    : { items: demoFoundersAsCards(), unavailable: false };

  return (
    <Container className="py-14 max-sm:py-8">
      <SectionHeading
        eyebrow="Desde o início"
        title="Criadores fundadores."
        description="As pessoas que publicaram os primeiros produtos da Automatize e ajudaram a construir o catálogo desde a fase inicial da plataforma."
      />

      <div className="mt-10">
        {founders.unavailable ? (
          <ErrorState description="Não conseguimos carregar os criadores fundadores agora. Tente novamente em instantes." />
        ) : founders.items.length === 0 ? (
          <EmptyState
            title="Nenhum criador fundador ainda"
            description="Assim que os primeiros criadores forem reconhecidos, eles aparecem aqui."
          />
        ) : (
          <ul className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
            {founders.items.map((founder) => (
              <li
                key={founder.id}
                className="flex flex-col gap-4 rounded-[14px] border border-line bg-white p-[22px]"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={founder.name} size={52} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] font-extrabold">{founder.name}</h3>
                      <Tag tone="ok">Fundador</Tag>
                    </div>
                    <p className="text-[13px] font-semibold text-blue-700">
                      {founder.headline}
                    </p>
                  </div>
                </div>

                <p className="text-[14px] leading-[1.65] text-muted">{founder.bio}</p>

                {founder.products.length > 0 ? (
                  <ul className="flex flex-col gap-2 border-t border-line pt-3">
                    {founder.products.map((product) => (
                      <li key={product.id} className="flex items-center justify-between gap-3">
                        <Link
                          href={`/products/${product.slug}`}
                          className="truncate text-[13.5px] font-semibold text-ink no-underline hover:text-blue-700"
                        >
                          {product.name}
                        </Link>
                        <span className="flex-none text-[12.5px] font-bold text-muted">
                          {formatPrice(product.priceCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}

async function loadRealFounders(): Promise<{
  items: FounderCardData[];
  unavailable: boolean;
}> {
  const { data, unavailable } = await resilient(
    listFoundingCreators,
    [],
    'founders.listing'
  );

  return {
    items: data.map((founder) => ({
      id: founder.id,
      slug: founder.id,
      name: founder.name,
      headline: founder.profile?.headline ?? 'Criador fundador',
      bio: founder.profile?.bio ?? '',
      products: founder.products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: product.priceCents,
        categoryName: product.category.name,
      })),
    })),
    unavailable,
  };
}

function demoFoundersAsCards(): FounderCardData[] {
  return listDemoFounders().map((founder) => ({
    id: founder.id,
    slug: founder.slug,
    name: founder.name,
    headline: founder.headline,
    bio: founder.bio,
    products: demoFounderProducts(founder).map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      priceCents: product.priceCents,
      categoryName: product.categoryName,
    })),
  }));
}
