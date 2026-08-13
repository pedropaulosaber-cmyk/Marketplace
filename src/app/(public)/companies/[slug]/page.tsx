import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, Container, Tag } from '@/components/ui/primitives';
import { Markdown } from '@/components/ui/markdown';
import { ProductCard, type ProductCardData } from '@/components/marketplace/product-card';
import { getCompanyBySlug } from '@/server/services/company-service';
import { isDatabaseConfigured } from '@/lib/env';
import {
  demoCompanyProducts,
  findDemoCompany,
  type DemoCompany,
  type DemoProduct,
} from '@/lib/demo-data';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isDatabaseConfigured) {
    const demo = findDemoCompany(slug);
    if (!demo) return { title: 'Empresa não encontrada', robots: { index: false } };
    return {
      title: `${demo.name} — Empresa parceira`,
      description: demo.tagline,
      alternates: { canonical: `/companies/${demo.slug}` },
      openGraph: {
        type: 'website',
        title: `${demo.name} · AUTOMATIZE`,
        description: demo.tagline,
        url: `/companies/${demo.slug}`,
      },
    };
  }

  const company = await getCompanyBySlug(slug);
  if (!company) return { title: 'Empresa não encontrada', robots: { index: false } };

  return {
    title: `${company.name} — Empresa parceira`,
    description: company.tagline,
    alternates: { canonical: `/companies/${company.slug}` },
    openGraph: {
      type: 'website',
      title: `${company.name} · AUTOMATIZE`,
      description: company.tagline,
      url: `/companies/${company.slug}`,
    },
  };
}

// Curated content, not user data — a short revalidate window keeps it off
// the database on every request without needing a manual cache-bust path.
export const revalidate = 600;

export default async function CompanyPage({ params }: PageProps) {
  const { slug } = await params;

  if (!isDatabaseConfigured) {
    const demo = findDemoCompany(slug);
    if (!demo) notFound();
    return <CompanyView company={demo} products={demoCompanyProducts(demo)} />;
  }

  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  return <CompanyView company={company} products={company.products} />;
}

interface CompanyViewData {
  slug: string;
  name: string;
  tagline: string;
  descriptionMd: string;
  website: string | null;
  location: string | null;
  featured: boolean;
}

function CompanyView({
  company,
  products,
}: {
  company: CompanyViewData | DemoCompany;
  products: (ProductCardData | DemoProduct)[];
}) {
  return (
    <Container className="py-12 max-sm:py-6">
      <nav aria-label="Trilha de navegação">
        <ol className="flex items-center gap-2 text-[13px] text-muted">
          <li>
            <Link href="/companies" className="no-underline hover:text-blue-700">
              Empresas
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-ink">
            {company.name}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid grid-cols-[1fr_300px] gap-14 max-lg:grid-cols-1 max-lg:gap-8">
        <div>
          <div className="flex items-start gap-5 max-sm:flex-col max-sm:gap-3">
            <Avatar name={company.name} size={72} />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[36px] leading-tight font-extrabold max-sm:text-[26px]">
                  {company.name}
                </h1>
                {company.featured ? <Tag tone="ok">Parceiro em destaque</Tag> : null}
              </div>
              <p className="mt-1 text-[17px] font-semibold text-blue-700">
                {company.tagline}
              </p>
              {company.location ? (
                <p className="mt-1 text-[13.5px] text-muted">{company.location}</p>
              ) : null}
            </div>
          </div>

          <section className="mt-10">
            <h2 className="text-[22px] font-extrabold">Sobre</h2>
            <div className="mt-3 max-w-[68ch]">
              <Markdown source={company.descriptionMd} />
            </div>
          </section>

          {products.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-[22px] font-extrabold">Produtos</h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                {products.map((product) => (
                  <li key={product.id}>
                    <ProductCard
                      product={toCardData(product)}
                      showFavorite={false}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="max-lg:order-first">
          <div className="sticky top-[100px] rounded-[14px] border border-line bg-white p-6 shadow-[0_12px_28px_rgb(15_23_42/0.06)]">
            <p className="text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">
              Parceiro Automatize
            </p>
            <dl className="mt-4 flex flex-col gap-3 text-[13.5px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Produtos publicados</dt>
                <dd className="font-bold">{products.length}</dd>
              </div>
              {company.website ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Site</dt>
                  <dd className="truncate font-bold">
                    <a
                      href={company.website}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="text-blue-700 no-underline hover:underline"
                    >
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-[1.5] text-muted">
              Todo produto publicado por uma empresa parceira passa pela mesma
              moderação de qualquer criador da Automatize.
            </p>
          </div>
        </aside>
      </div>
    </Container>
  );
}

/** Both the real query and the demo catalogue already carry this shape; this
 * only bridges the tagline/category-name naming difference between them. */
function toCardData(product: ProductCardData | DemoProduct): ProductCardData {
  if ('category' in product) return product;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    priceCents: product.priceCents,
    ratingSum: product.ratingSum,
    ratingCount: product.ratingCount,
    category: { name: product.categoryName },
    author: { name: product.authorName },
  };
}
