import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import {
  Container,
  EmptyState,
  SectionHeading,
  Tag,
  Thumb,
} from '@/components/ui/primitives';
import { FormSuccess } from '@/components/ui/field';
import { DownloadButton } from './_components/download-button';
import { listLibrary } from '@/server/services/order-service';
import { requireUser } from '@/server/auth/rbac';
import { formatPrice } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Minha biblioteca',
  description: 'Produtos que você adquiriu na AUTOMATIZE.',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const [items, params] = await Promise.all([
    listLibrary(user.id),
    searchParams,
  ]);

  const welcome = typeof params.welcome === 'string' ? params.welcome : null;

  return (
    <Container className="py-14 max-sm:py-8">
      <SectionHeading
        eyebrow="Biblioteca"
        title="Tudo o que você adquiriu."
        description="Acesse, baixe e acompanhe as atualizações dos seus produtos."
      />

      {welcome ? (
        <div className="mt-6">
          <FormSuccess
            message={`Compra confirmada — pedido ${welcome}. Seus arquivos já estão disponíveis abaixo.`}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Sua biblioteca está vazia"
            description="Assim que você comprar um produto, ele aparece aqui com os arquivos, as atualizações e o histórico de downloads."
            action={<LinkButton href="/products">Explorar produtos</LinkButton>}
          />
        </div>
      ) : (
        <ul className="mt-10 flex flex-col gap-5">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[120px_1fr_auto] gap-6 rounded-[14px] border border-line bg-white p-5 max-lg:grid-cols-1 max-lg:gap-4"
            >
              <Thumb className="h-[90px] w-full max-lg:h-[120px]" />

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Tag>{item.product.category.name}</Tag>
                  <span className="text-[12.5px] text-muted">
                    Pedido {item.order.number}
                    {item.order.paidAt
                      ? ` · ${item.order.paidAt.toLocaleDateString('pt-BR')}`
                      : ''}
                  </span>
                </div>

                <h2 className="mt-2 text-[19px] font-extrabold">
                  {/* The product may have been archived after purchase — the
                      buyer keeps access, but the public page is gone. */}
                  {item.product.deletedAt ? (
                    item.productName
                  ) : (
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="text-ink no-underline hover:text-blue-700"
                    >
                      {item.product.name}
                    </Link>
                  )}
                </h2>

                <p className="mt-1 text-[13.5px] text-muted">
                  por {item.product.author.name} ·{' '}
                  {formatPrice(item.unitCents)}
                </p>

                {item.product.files.length > 0 ? (
                  <ul className="mt-4 flex flex-col gap-2">
                    {item.product.files.map((file) => (
                      <li
                        key={file.id}
                        className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-bg px-4 py-3"
                      >
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#64748B"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="flex-none"
                        >
                          <path d="M14 3v5h5" />
                          <path d="M6 3h8l5 5v13H6z" />
                        </svg>
                        <span className="flex-1 text-[13.5px] font-medium">
                          {file.fileName}
                        </span>
                        <span className="text-[12.5px] text-muted">
                          v{file.version} · {formatBytes(file.sizeBytes)}
                        </span>
                        <DownloadButton
                          fileId={file.id}
                          fileName={file.fileName}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-[10px] border border-dashed border-line px-4 py-3 text-[13px] text-muted">
                    Este produto não tem arquivos para download. O acesso é
                    feito pelas integrações descritas na página do produto.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 max-lg:flex-row">
                {!item.product.deletedAt ? (
                  <LinkButton
                    href={`/products/${item.product.slug}`}
                    variant="secondary"
                    size="sm"
                  >
                    Ver produto
                  </LinkButton>
                ) : null}
                <LinkButton href="/orders" variant="ghost" size="sm">
                  Pedido
                </LinkButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
