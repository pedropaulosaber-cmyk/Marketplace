import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { EmptyState, StatusTag } from '@/components/ui/primitives';
import {
  DataTable,
  PageHeader,
  Panel,
  Td,
} from '@/components/dashboard/panels';
import { ProductRowActions } from './_components/product-row-actions';
import { requireUser } from '@/server/auth/rbac';
import { listOwnProducts, averageRating } from '@/server/services/product-service';
import { formatMoney, formatPrice } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Meus produtos',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();

  // A buyer has no products page. Send them somewhere useful rather than
  // rendering an empty screen they cannot act on.
  if (!user.roles.includes('CREATOR') && !user.roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : undefined;
  const products = await listOwnProducts(user, query);

  const revenue = products.reduce(
    (sum, product) => sum + product.salesCount * product.priceCents,
    0
  );

  return (
    <>
      <PageHeader
        title="Meus produtos"
        description="Gerencie o catálogo, acompanhe o status de revisão e as vendas de cada produto."
        action={
          <LinkButton href="/dashboard/products/new">Novo produto</LinkButton>
        }
      />

      <Panel
        title={`${products.length} ${products.length === 1 ? 'produto' : 'produtos'}`}
        description={`Receita bruta acumulada: ${formatMoney(revenue)}`}
      >
        {products.length === 0 ? (
          <EmptyState
            title="Nenhum produto ainda"
            description="Publique sua primeira solução. Descreva o que ela resolve, defina o preço e envie para revisão — leva até 3 dias úteis."
            action={
              <LinkButton href="/dashboard/products/new">
                Criar meu primeiro produto
              </LinkButton>
            }
          />
        ) : (
          <DataTable
            caption="Seus produtos"
            headers={[
              'Produto',
              'Categoria',
              'Preço',
              'Vendas',
              'Nota',
              'Status',
              'Ações',
            ]}
            minWidth={880}
          >
            {products.map((product) => {
              const rating = averageRating(
                product.ratingSum,
                product.ratingCount
              );

              return (
                <tr key={product.id}>
                  <Td bold>
                    {product.status === 'PUBLISHED' ? (
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-ink no-underline hover:text-blue-700"
                      >
                        {product.name}
                      </Link>
                    ) : (
                      product.name
                    )}
                  </Td>
                  <Td muted>{product.category.name}</Td>
                  <Td>{formatPrice(product.priceCents)}</Td>
                  <Td>{product.salesCount}</Td>
                  <Td muted>
                    {rating ? `${rating} (${product.ratingCount})` : '—'}
                  </Td>
                  <Td>
                    <StatusTag status={product.status} />
                  </Td>
                  <Td>
                    <ProductRowActions
                      productId={product.id}
                      status={product.status}
                    />
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
