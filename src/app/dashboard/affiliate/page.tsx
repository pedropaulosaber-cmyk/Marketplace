import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader, Kpi, KpiGrid, Panel } from '@/components/dashboard/panels';
import { EmptyState, Tag } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { getSession } from '@/server/auth/session';
import { listOwnAffiliations } from '@/server/services/affiliate-service';
import { formatPrice } from '@/lib/money';
import { ReferralLink } from './_components/referral-link';

export const metadata: Metadata = {
  title: 'Produtos que promovo',
  robots: { index: false },
};

const STATUS_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  APPROVED: { label: 'Aprovado', tone: 'ok' },
  PENDING: { label: 'Aguardando aprovação', tone: 'warn' },
  REJECTED: { label: 'Recusado', tone: 'neutral' },
  BLOCKED: { label: 'Bloqueado', tone: 'neutral' },
};

export default async function AffiliateDashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=%2Fdashboard%2Faffiliate');

  const affiliations = await listOwnAffiliations(session.id);

  const totals = affiliations.reduce(
    (accumulator, item) => ({
      pending: accumulator.pending + item.earnings.pending,
      paid: accumulator.paid + item.earnings.paid,
      clicks: accumulator.clicks + item.clickCount,
      sales: accumulator.sales + item.conversionCount,
    }),
    { pending: 0, paid: 0, clicks: 0, sales: 0 }
  );

  // Conversion is the number an affiliate actually optimises against, so it is
  // shown even when it is zero rather than hidden until it looks good.
  const conversion =
    totals.clicks > 0
      ? `${((totals.sales / totals.clicks) * 100).toFixed(1)}%`
      : '—';

  return (
    <>
      <PageHeader
        title="Produtos que promovo"
        description="Divulgue produtos de outros criadores e receba comissão por cada venda atribuída ao seu link."
      />

      <KpiGrid>
        <Kpi label="A receber" value={formatPrice(totals.pending)} />
        <Kpi label="Já recebido" value={formatPrice(totals.paid)} />
        <Kpi label="Cliques" value={String(totals.clicks)} />
        <Kpi label="Conversão" value={conversion} />
      </KpiGrid>

      <Panel title="Meus links">
        {affiliations.length === 0 ? (
          <EmptyState
            title="Você ainda não promove nenhum produto"
            description="Encontre um produto com programa de afiliados aberto, pegue seu link e ganhe uma comissão sobre cada venda que vier por ele."
            action={<LinkButton href="/products">Ver produtos</LinkButton>}
          />
        ) : (
          <ul className="flex flex-col gap-5">
            {affiliations.map((affiliation) => {
              const status =
                STATUS_LABEL[affiliation.status] ?? STATUS_LABEL.PENDING!;
              const { product, commissionBps, enabled } = affiliation.program;
              const perSale = Math.floor(
                (product.priceCents * commissionBps) / 10_000
              );

              return (
                <li
                  key={affiliation.id}
                  className="rounded-[14px] border border-line bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[16px] font-extrabold">
                        <Link
                          href={`/products/${product.slug}`}
                          className="text-ink no-underline hover:text-blue-700"
                        >
                          {product.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-[13px] text-muted">
                        {(commissionBps / 100).toFixed(0)}% de comissão ·{' '}
                        {formatPrice(perSale)} por venda
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tone={status.tone}>{status.label}</Tag>
                      {!enabled ? (
                        <Tag tone="neutral">Programa pausado</Tag>
                      ) : null}
                    </div>
                  </div>

                  {affiliation.status === 'APPROVED' && enabled ? (
                    <div className="mt-4">
                      <ReferralLink slug={product.slug} code={affiliation.code} />
                    </div>
                  ) : (
                    <p className="mt-4 rounded-[10px] border border-dashed border-line bg-bg px-4 py-3 text-[13px] text-muted">
                      {affiliation.status === 'PENDING'
                        ? 'Seu link aparece aqui assim que o criador aprovar sua participação.'
                        : 'Este programa não está ativo para você no momento.'}
                    </p>
                  )}

                  <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-3 text-[13px]">
                    <div className="flex items-center gap-2">
                      <dt className="text-muted">Cliques</dt>
                      <dd className="font-bold">{affiliation.clickCount}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt className="text-muted">Vendas</dt>
                      <dd className="font-bold">{affiliation.conversionCount}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt className="text-muted">A receber</dt>
                      <dd className="font-bold">
                        {formatPrice(affiliation.earnings.pending)}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
