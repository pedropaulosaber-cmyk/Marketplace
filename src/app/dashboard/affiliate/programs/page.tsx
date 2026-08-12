import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Panel } from '@/components/dashboard/panels';
import { EmptyState, Tag } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { requirePermission } from '@/server/auth/rbac';
import { db } from '@/server/db/client';
import { listProgramAffiliates } from '@/server/services/affiliate-service';
import { env } from '@/lib/env';
import { formatPrice } from '@/lib/money';
import { ProgramForm } from './_components/program-form';
import { AffiliateDecision } from './_components/affiliate-decision';

export const metadata: Metadata = {
  title: 'Meus afiliados',
  robots: { index: false },
};

const STATUS_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  APPROVED: { label: 'Aprovado', tone: 'ok' },
  PENDING: { label: 'Aguardando', tone: 'warn' },
  REJECTED: { label: 'Recusado', tone: 'neutral' },
  BLOCKED: { label: 'Bloqueado', tone: 'neutral' },
};

export default async function AffiliateProgramsPage() {
  const user = await requirePermission('affiliate:program:manage');

  // Every published product is listed, not just the ones with a programme —
  // the page has to be somewhere a creator can *open* a programme, not only
  // manage ones that already exist.
  const products = await db.product.findMany({
    where: { authorId: user.id, deletedAt: null, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      priceCents: true,
      affiliateProgram: {
        select: {
          id: true,
          enabled: true,
          commissionBps: true,
          cookieDays: true,
          autoApprove: true,
          terms: true,
        },
      },
    },
  });

  const affiliatesByProgram = new Map(
    await Promise.all(
      products
        .filter((product) => product.affiliateProgram)
        .map(
          async (product) =>
            [
              product.affiliateProgram!.id,
              await listProgramAffiliates(product.affiliateProgram!.id),
            ] as const
        )
    )
  );

  return (
    <>
      <PageHeader
        title="Meus afiliados"
        description="Deixe outras pessoas venderem seus produtos e pague comissão só quando a venda acontecer."
      />

      {products.length === 0 ? (
        <Panel title="Programas">
          <EmptyState
            title="Você ainda não tem produtos publicados"
            description="Um programa de afiliados é aberto por produto. Publique o primeiro para poder convidar afiliados."
            action={
              <LinkButton href="/dashboard/products/new">
                Publicar produto
              </LinkButton>
            }
          />
        </Panel>
      ) : (
        products.map((product) => {
          const program = product.affiliateProgram;
          const affiliates = program
            ? (affiliatesByProgram.get(program.id) ?? [])
            : [];

          return (
            <Panel
              key={product.id}
              title={product.name}
              action={
                <Link
                  href={`/products/${product.slug}`}
                  className="text-[13px] font-semibold text-blue-700 no-underline"
                >
                  Ver produto
                </Link>
              }
            >
              <div className="flex flex-col gap-7">
                <ProgramForm
                  productId={product.id}
                  priceCents={product.priceCents}
                  platformFeeBps={env.PLATFORM_FEE_BPS}
                  initial={{
                    enabled: program?.enabled ?? false,
                    commissionPercent: program
                      ? program.commissionBps / 100
                      : 20,
                    cookieDays: program?.cookieDays ?? 30,
                    autoApprove: program?.autoApprove ?? true,
                    terms: program?.terms ?? '',
                  }}
                />

                {program ? (
                  <div className="border-t border-line pt-6">
                    <h3 className="text-[15px] font-extrabold">
                      Afiliados ({affiliates.length})
                    </h3>

                    {affiliates.length === 0 ? (
                      <p className="mt-3 rounded-[10px] border border-dashed border-line bg-bg px-4 py-3 text-[13px] text-muted">
                        Ninguém se afiliou a este produto ainda. O convite fica
                        na própria página do produto.
                      </p>
                    ) : (
                      <ul className="mt-3 flex flex-col gap-3">
                        {affiliates.map((affiliate) => {
                          const status =
                            STATUS_LABEL[affiliate.status] ??
                            STATUS_LABEL.PENDING!;
                          const earned = Math.floor(
                            (product.priceCents * program.commissionBps) /
                              10_000
                          );

                          return (
                            <li
                              key={affiliate.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-white p-4"
                            >
                              <div>
                                <p className="text-[14px] font-bold">
                                  {affiliate.user.name}
                                </p>
                                <p className="mt-[2px] text-[12.5px] text-muted">
                                  {affiliate.clickCount} cliques ·{' '}
                                  {affiliate.conversionCount} vendas ·{' '}
                                  {formatPrice(
                                    earned * affiliate.conversionCount
                                  )}{' '}
                                  em comissão
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <Tag tone={status.tone}>{status.label}</Tag>
                                <AffiliateDecision
                                  affiliateId={affiliate.id}
                                  status={affiliate.status}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </Panel>
          );
        })
      )}
    </>
  );
}
