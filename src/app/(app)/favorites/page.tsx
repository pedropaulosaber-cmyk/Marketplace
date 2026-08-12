import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import {
  Avatar,
  Container,
  EmptyState,
  SectionHeading,
  Tag,
} from '@/components/ui/primitives';
import { ProductCard } from '@/components/marketplace/product-card';
import { FavoriteButton } from '@/components/marketplace/favorite-button';
import { listFavorites } from '@/server/services/engagement-service';
import { requireUser } from '@/server/auth/rbac';
import { formatRange } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Favoritos',
  description: 'Produtos e profissionais que você salvou.',
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const user = await requireUser();
  const favorites = await listFavorites(user.id);

  const products = favorites.filter((f) => f.product !== null);
  const professionals = favorites.filter((f) => f.professional !== null);

  return (
    <Container className="py-14 max-sm:py-8">
      <SectionHeading
        eyebrow="Favoritos"
        title="O que você salvou para depois."
        description="Produtos e profissionais guardados em um lugar só."
      />

      {favorites.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nada salvo ainda"
            description="Use o coração nos cards de produtos e nos perfis de profissionais para guardar o que interessa."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <LinkButton href="/products">Explorar produtos</LinkButton>
                <LinkButton href="/professionals" variant="secondary">
                  Ver profissionais
                </LinkButton>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {products.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-[24px] font-extrabold">
                Produtos ({products.length})
              </h2>
              <ul className="mt-5 grid grid-cols-4 gap-[14px] max-lg:grid-cols-2 max-sm:grid-cols-1">
                {products.map((favorite) => {
                  const product = favorite.product!;

                  // A product unpublished after being favourited stays in the
                  // list but is shown as unavailable rather than silently
                  // linking to a 404.
                  if (product.status !== 'PUBLISHED') {
                    return (
                      <li
                        key={favorite.id}
                        className="flex flex-col justify-between gap-3 rounded-[14px] border border-dashed border-line bg-bg p-4"
                      >
                        <div>
                          <Tag tone="neutral">Indisponível</Tag>
                          <p className="mt-2 text-[14.5px] font-bold">
                            {product.name}
                          </p>
                          <p className="mt-1 text-[12.5px] text-muted">
                            Este produto não está mais publicado.
                          </p>
                        </div>
                        <FavoriteButton
                          productId={product.id}
                          initial
                          label={product.name}
                        />
                      </li>
                    );
                  }

                  return (
                    <li key={favorite.id} className="contents">
                      <ProductCard
                        product={{
                          ...product,
                          category: product.category,
                          author: product.author,
                        }}
                        favorited
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {professionals.length > 0 ? (
            <section className="mt-14">
              <h2 className="text-[24px] font-extrabold">
                Profissionais ({professionals.length})
              </h2>
              <ul className="mt-5 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
                {professionals.map((favorite) => {
                  const pro = favorite.professional!;

                  return (
                    <li
                      key={favorite.id}
                      className="relative flex flex-col gap-3 rounded-[14px] border border-line bg-white p-[22px] transition-colors hover:border-blue"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar name={pro.user.name} size={42} />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[17px] font-extrabold">
                              <Link
                                href={`/professionals/${pro.slug}`}
                                className="text-ink no-underline hover:text-ink"
                              >
                                {pro.user.name}
                              </Link>
                            </h3>
                            {pro.verified ? <Tag tone="ok">Verificado</Tag> : null}
                          </div>
                          <p className="text-[13.5px] font-semibold text-blue-700">
                            {pro.title}
                          </p>
                        </div>
                        <FavoriteButton
                          professionalId={pro.id}
                          initial
                          label={pro.user.name}
                          className="relative z-10"
                        />
                      </div>

                      <p className="line-clamp-2 text-[14px] leading-[1.6] text-muted">
                        {pro.bio}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-[13px]">
                        <span className="text-muted">
                          {pro.projectsCount} projetos
                        </span>
                        <span className="font-bold">
                          {pro.rateMaxCents > 0
                            ? formatRange(pro.rateMinCents, pro.rateMaxCents)
                            : 'Sob consulta'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </Container>
  );
}
