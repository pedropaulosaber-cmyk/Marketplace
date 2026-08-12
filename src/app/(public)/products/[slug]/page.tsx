import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Avatar,
  Container,
  Rating,
  Tag,
  Thumb,
} from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { Markdown } from '@/components/ui/markdown';
import { ProductCardCompact } from '@/components/marketplace/product-card';
import { ProductGallery } from '@/components/marketplace/product-gallery';
import { ProductVideo } from '@/components/marketplace/product-video';
import { FavoriteButton } from '@/components/marketplace/favorite-button';
import { publicUrl } from '@/server/storage';
import { BuyButton } from './_components/buy-button';
import { ReviewForm } from './_components/review-form';
import {
  getProductBySlug,
  getRelatedProducts,
} from '@/server/services/product-service';
import { hasPurchased } from '@/server/services/order-service';
import { canReview } from '@/server/services/review-service';
import { db } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { formatPrice } from '@/lib/money';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Per-product metadata. Everything a crawler and a social preview need is
 * derived from the record itself, so every product page is individually
 * indexable and shares cleanly.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: 'Produto não encontrado', robots: { index: false } };
  }

  const title = product.name;
  const description = product.tagline.slice(0, 160);

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: `${title} · AUTOMATIZE`,
      description,
      url: `/products/${product.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · AUTOMATIZE`,
      description,
    },
  };
}

/**
 * Pre-render the best-selling products at build time.
 *
 * Runs during `next build`, unlike the page itself (pushed to on-demand
 * rendering by the session cookie read in the shared layout). If the
 * database is not reachable yet, prerender nothing rather than fail the
 * build — `dynamicParams` defaults to true, so every product still renders
 * correctly on its first real request, just without the build-time head
 * start. The next build picks the static list back up automatically.
 */
export async function generateStaticParams() {
  try {
    const products = await db.product.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { slug: true },
      orderBy: { salesCount: 'desc' },
      take: 50,
    });

    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export const revalidate = 600;

const HOW_IT_WORKS = [
  {
    n: '01',
    t: 'Conecte as contas',
    b: 'Assistente guiado liga as integrações listadas. Nenhum acesso fica com o criador.',
  },
  {
    n: '02',
    t: 'Ajuste as regras',
    b: 'Prompts, critérios e limites são editáveis por formulário, sem tocar em código.',
  },
  {
    n: '03',
    t: 'Teste com dado real',
    b: 'Ambiente isolado com amostra da sua base antes de qualquer envio ao cliente final.',
  },
  {
    n: '04',
    t: 'Publique',
    b: 'Vai ao ar e o painel acompanha volume, custo e falhas na primeira semana.',
  },
] as const;

const ASSURANCES = [
  'Reembolso integral em até 14 dias',
  'Criador verificado por documento e histórico',
  'Pagamento processado pela Automatize',
] as const;

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const session = await getSession();

  const [related, owned, reviewable, favorited] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId, product.authorId),
    session ? hasPurchased(session.id, product.id) : Promise.resolve(false),
    session ? canReview(session.id, product.id) : Promise.resolve(false),
    session
      ? db.favorite
          .findUnique({
            where: {
              userId_productId: { userId: session.id, productId: product.id },
            },
            select: { id: true },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ]);

  const average =
    product.ratingCount > 0 ? product.ratingSum / product.ratingCount : null;
  const isOwnProduct = session?.id === product.authorId;

  const galleryImages = product.images.map((image) => ({
    id: image.id,
    src: publicUrl(image.storageKey),
    alt: image.alt,
  }));

  return (
    <>
      <ProductStructuredData
        product={product}
        average={average}
        url={`/products/${product.slug}`}
      />

      <Container className="py-10 max-sm:py-6">
        <Breadcrumbs
          category={product.category.name}
          categorySlug={product.category.slug}
          name={product.name}
        />

        <div className="mt-6 grid grid-cols-[1fr_360px] gap-14 max-lg:grid-cols-1 max-lg:gap-8">
          {/* --- Main column --- */}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Tag>{product.category.name}</Tag>
              {product.tags.map(({ tag }) => (
                <Tag key={tag.slug} tone="neutral">
                  {tag.name}
                </Tag>
              ))}
            </div>

            <h1 className="mt-4 text-[42px] leading-[1.08] font-extrabold max-sm:text-[28px]">
              {product.name}
            </h1>

            <p className="mt-4 max-w-[62ch] text-[18px] leading-[1.55] text-[#475569] max-sm:text-[16px]">
              {product.tagline}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-5">
              <Link
                href={
                  product.author.professional
                    ? `/professionals/${product.author.professional.slug}`
                    : '/professionals'
                }
                className="flex items-center gap-[10px] no-underline"
              >
                <Avatar name={product.author.name} size={38} />
                <span>
                  <span className="block text-[14px] font-bold text-ink">
                    {product.author.name}
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {product.author._count.products} produtos publicados
                  </span>
                </span>
              </Link>

              {product.author.professional?.verified ? (
                <Tag tone="ok">Criador verificado</Tag>
              ) : null}

              <Rating value={average} count={product.ratingCount} className="text-[14px]" />
            </div>

            <div className="mt-8 flex flex-col gap-5">
              {galleryImages.length > 0 ? (
                <ProductGallery images={galleryImages} />
              ) : (
                <Thumb className="h-[320px] w-full max-sm:h-[190px]" />
              )}

              {product.videoUrl ? (
                <ProductVideo url={product.videoUrl} productName={product.name} />
              ) : null}
            </div>

            {product.descriptionMd.trim() ? (
              <Section title="Sobre o produto">
                <Markdown source={product.descriptionMd} />
              </Section>
            ) : null}

            <Section title="Benefícios">
              <ul className="flex flex-col gap-3">
                {product.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-[15px] leading-[1.6]">
                    <CheckIcon />
                    {benefit}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Como funciona">
              <ol className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
                {HOW_IT_WORKS.map((step) => (
                  <li
                    key={step.n}
                    className="rounded-[14px] border border-line bg-white p-5"
                  >
                    <span className="text-[13px] font-extrabold text-blue">
                      {step.n}
                    </span>
                    <p className="mt-2 text-[16px] font-bold">{step.t}</p>
                    <p className="mt-1 text-[14px] leading-[1.6] text-muted">
                      {step.b}
                    </p>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="O que está incluído">
              <ul className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                {product.included.map((item) => (
                  <li key={item} className="flex gap-3 text-[14.5px] leading-[1.6]">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <div className="mt-10 grid grid-cols-2 gap-6 max-sm:grid-cols-1">
              <div>
                <h3 className="text-[17px] font-extrabold">Integrações</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.integrations.map((item) => (
                    <Tag key={item} tone="neutral">
                      {item}
                    </Tag>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[17px] font-extrabold">Compatibilidade</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.compat.map((item) => (
                    <Tag key={item} tone="neutral">
                      {item}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>

            <Section title="Requisitos">
              <ul className="flex flex-col gap-3">
                {product.requirements.map((item) => (
                  <li key={item} className="flex gap-3 text-[14.5px] leading-[1.6]">
                    <span aria-hidden="true" className="text-muted">
                      •
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            {/* --- Reviews --- */}
            <Section title={`Avaliações (${product.ratingCount})`}>
              {reviewable ? (
                <div className="mb-8 rounded-[14px] border border-line bg-bg p-5">
                  <p className="text-[15px] font-bold">
                    Você comprou este produto. Como foi a experiência?
                  </p>
                  <ReviewForm productId={product.id} />
                </div>
              ) : null}

              {product.reviews.length === 0 ? (
                <p className="rounded-[14px] border border-dashed border-line bg-bg px-6 py-10 text-center text-[14.5px] text-muted">
                  Este produto ainda não tem avaliações. Só quem comprou pode
                  avaliar.
                </p>
              ) : (
                <ul className="flex flex-col gap-5">
                  {product.reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-[14px] border border-line bg-white p-5"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={review.author.name} size={34} />
                        <div className="flex-1">
                          <p className="text-[14px] font-bold">
                            {review.author.name}
                          </p>
                          {review.author.profile?.headline ? (
                            <p className="text-[12.5px] text-muted">
                              {review.author.profile.headline}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-[13px] text-star" aria-hidden="true">
                          {'★'.repeat(review.rating)}
                          <span className="text-line">
                            {'★'.repeat(5 - review.rating)}
                          </span>
                        </span>
                        <span className="sr-only">
                          {review.rating} de 5 estrelas
                        </span>
                      </div>

                      <p className="mt-3 text-[14.5px] leading-[1.65]">
                        {review.comment}
                      </p>

                      {review.reply ? (
                        <div className="mt-4 rounded-[10px] border-l-2 border-blue bg-sky p-4">
                          <p className="text-[12.5px] font-bold text-blue-700">
                            Resposta do criador
                          </p>
                          <p className="mt-1 text-[14px] leading-[1.6]">
                            {review.reply.body}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {/* --- Purchase panel --- */}
          <aside className="max-lg:order-first">
            <div className="sticky top-[100px] rounded-[14px] border border-line bg-white p-6 shadow-[0_12px_28px_rgb(15_23_42/0.06)]">
              <p className="text-[34px] leading-none font-extrabold">
                {formatPrice(product.priceCents)}
              </p>
              <p className="mt-2 text-[13px] leading-[1.5] text-muted">
                {product.priceCents === 0
                  ? 'Versão gratuita. Upgrade disponível dentro do produto.'
                  : 'Pagamento único · 90 dias de suporte do criador incluídos'}
              </p>

              <div className="mt-5 flex flex-col gap-3">
                {owned ? (
                  <LinkButton href="/library" fullWidth size="lg">
                    Acessar na biblioteca
                  </LinkButton>
                ) : isOwnProduct ? (
                  <LinkButton
                    href="/dashboard/products"
                    variant="secondary"
                    fullWidth
                    size="lg"
                  >
                    Gerenciar este produto
                  </LinkButton>
                ) : (
                  <BuyButton
                    productId={product.id}
                    isFree={product.priceCents === 0}
                    signedIn={Boolean(session)}
                    slug={product.slug}
                  />
                )}

                <div className="flex items-center gap-3">
                  <FavoriteButton
                    productId={product.id}
                    initial={favorited}
                    label={product.name}
                  />
                  <span className="text-[13px] text-muted">
                    Salvar para depois
                  </span>
                </div>
              </div>

              <ul className="mt-6 flex flex-col gap-[10px] border-t border-line pt-5">
                {ASSURANCES.map((item) => (
                  <li
                    key={item}
                    className="flex gap-[10px] text-[13px] leading-[1.5] text-[#475569]"
                  >
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>

              {product.files.length > 0 ? (
                <p className="mt-5 border-t border-line pt-4 text-[12.5px] text-muted">
                  {product.files.length}{' '}
                  {product.files.length === 1 ? 'arquivo' : 'arquivos'} ·
                  versão {product.files[0]?.version}
                </p>
              ) : null}
            </div>
          </aside>
        </div>

        {related.length > 0 ? (
          <section className="mt-20 max-sm:mt-12">
            <h2 className="text-[26px] font-extrabold">Produtos relacionados</h2>
            <ul className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-2">
              {related.map((item) => (
                <li key={item.id} className="contents">
                  <ProductCardCompact product={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </>
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
    <section className="mt-12 max-sm:mt-9">
      <h2 className="mb-5 text-[26px] font-extrabold max-sm:text-[21px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2563EB"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-[3px] flex-none"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function Breadcrumbs({
  category,
  categorySlug,
  name,
}: {
  category: string;
  categorySlug: string;
  name: string;
}) {
  return (
    <nav aria-label="Trilha de navegação">
      <ol className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <li>
          <Link href="/products" className="no-underline hover:text-blue-700">
            Produtos
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            href={`/products?category=${encodeURIComponent(categorySlug)}`}
            className="no-underline hover:text-blue-700"
          >
            {category}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="font-medium text-ink">
          {name}
        </li>
      </ol>
    </nav>
  );
}

/** schema.org Product markup, so the listing can earn a rich result. */
function ProductStructuredData({
  product,
  average,
  url,
}: {
  product: {
    name: string;
    tagline: string;
    priceCents: number;
    currency: string;
    ratingCount: number;
    author: { name: string };
  };
  average: number | null;
  url: string;
}) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.tagline,
    brand: { '@type': 'Brand', name: 'AUTOMATIZE' },
    offers: {
      '@type': 'Offer',
      url: `${base}${url}`,
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Person', name: product.author.name },
    },
    ...(average !== null && product.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: average.toFixed(1),
            reviewCount: product.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
