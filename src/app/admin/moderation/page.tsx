import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, Tag } from '@/components/ui/primitives';
import { PageHeader, Panel } from '@/components/dashboard/panels';
import { ModerationCard } from './_components/moderation-card';
import { listModerationQueue } from '@/server/services/admin-service';
import { formatPrice } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Moderação',
  robots: { index: false, follow: false },
};

/**
 * Moderation queue.
 *
 * Approving publishes a product to the public catalog, so each entry shows
 * everything a reviewer needs to decide — price, deliverables, author — before
 * the decision, not after.
 */
export default async function ModerationPage() {
  const queue = await listModerationQueue();

  return (
    <>
      <PageHeader
        title="Moderação de produtos"
        description="Aprovar publica o produto imediatamente no catálogo público. Rejeitar exige um motivo, que é enviado ao criador."
      />

      <Panel
        title={`${queue.length} ${queue.length === 1 ? 'produto aguardando' : 'produtos aguardando'}`}
      >
        {queue.length === 0 ? (
          <EmptyState
            title="Nada para revisar"
            description="Todos os produtos enviados já foram avaliados."
          />
        ) : (
          <ul className="flex flex-col gap-5">
            {queue.map((product) => (
              <li
                key={product.id}
                className="rounded-[12px] border border-line p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Tag>{product.category.name}</Tag>
                  <Tag tone="warn">Em revisão</Tag>
                  <span className="text-[12.5px] text-muted">
                    enviado em{' '}
                    {product.submittedAt
                      ? product.submittedAt.toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>

                <h3 className="mt-3 text-[19px] font-extrabold">
                  {product.name}
                </h3>
                <p className="mt-1 text-[14px] leading-[1.6] text-muted">
                  {product.tagline}
                </p>

                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                  <div className="flex gap-2">
                    <dt className="text-muted">Criador</dt>
                    <dd className="font-bold">{product.author.name}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted">Preço</dt>
                    <dd className="font-bold">
                      {formatPrice(product.priceCents)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted">Arquivos</dt>
                    <dd className="font-bold">{product._count.files}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted">Imagens</dt>
                    <dd className="font-bold">{product._count.images}</dd>
                  </div>
                </dl>

                {/* A paid product with no deliverable would take money for
                    nothing — surface it prominently for the reviewer. */}
                {product.priceCents > 0 && product._count.files === 0 ? (
                  <p
                    role="alert"
                    className="mt-4 rounded-[8px] border border-danger-fg/25 bg-danger-bg px-4 py-3 text-[13px] font-semibold text-danger-fg"
                  >
                    Produto pago sem nenhum arquivo entregável. Não aprovar sem
                    verificar como a entrega será feita.
                  </p>
                ) : null}

                <div className="mt-4">
                  <Link
                    href={`/products/${product.slug}`}
                    className="text-[13px] font-semibold"
                  >
                    Pré-visualizar página do produto →
                  </Link>
                </div>

                <ModerationCard productId={product.id} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
