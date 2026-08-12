import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, StatusTag } from '@/components/ui/primitives';
import { DataTable, PageHeader, Panel, Td } from '@/components/dashboard/panels';
import { listAllProducts } from '@/server/services/admin-service';
import { formatPrice } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Produtos',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : undefined;

  const products = await listAllProducts(query);

  return (
    <>
      <PageHeader
        title="Todos os produtos"
        description="Catálogo completo, em qualquer estado de publicação."
      />

      <Panel
        title={`${products.length} ${products.length === 1 ? 'produto' : 'produtos'}`}
      >
        {products.length === 0 ? (
          <EmptyState
            title="Nenhum produto"
            description="Nada publicado ou em rascunho na plataforma ainda."
          />
        ) : (
          <DataTable
            caption="Produtos da plataforma"
            headers={['Produto', 'Criador', 'Categoria', 'Preço', 'Vendas', 'Status', 'Criado em']}
            minWidth={940}
          >
            {products.map((product) => (
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
                <Td muted>{product.author.name}</Td>
                <Td muted>{product.category.name}</Td>
                <Td>{formatPrice(product.priceCents)}</Td>
                <Td>{product.salesCount}</Td>
                <Td>
                  <StatusTag status={product.status} />
                </Td>
                <Td muted>{product.createdAt.toLocaleDateString('pt-BR')}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
