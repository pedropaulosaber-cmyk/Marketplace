import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmptyState, StatusTag } from '@/components/ui/primitives';
import {
  DataTable,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  Td,
} from '@/components/dashboard/panels';
import { requireUser } from '@/server/auth/rbac';
import { getPayouts, getSellerKpis } from '@/server/services/analytics-service';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Receitas',
  robots: { index: false, follow: false },
};

/**
 * Earnings ledger.
 *
 * Every settled sale creates a payout row scheduled for D+15, matching the
 * published commission terms. Refunded orders mark their payout as failed, so
 * this page is the seller's authoritative view of what they are actually owed.
 */
export default async function EarningsPage() {
  const user = await requireUser();

  if (!user.roles.includes('CREATOR') && !user.roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const [payouts, kpis] = await Promise.all([
    getPayouts(user.id),
    getSellerKpis(user.id),
  ]);

  const paid = payouts
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amountCents, 0);

  const scheduled = payouts
    .filter((p) => p.status === 'SCHEDULED')
    .reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <>
      <PageHeader
        title="Receitas e repasses"
        description="Comissão de 15% sobre cada venda concluída. Repasse em D+15, com nota emitida pela plataforma."
      />

      <KpiGrid>
        <Kpi
          label="Total ganho"
          value={formatMoney(kpis.revenueCents)}
          delta="líquido de comissão"
        />
        <Kpi label="Já repassado" value={formatMoney(paid)} tone="up" />
        <Kpi
          label="A repassar"
          value={formatMoney(scheduled)}
          delta="agendado"
          tone="neutral"
        />
        <Kpi label="Pedidos pagos" value={String(kpis.orders)} />
      </KpiGrid>

      <Panel
        title="Histórico de repasses"
        description="Cada linha corresponde a uma venda confirmada."
      >
        {payouts.length === 0 ? (
          <EmptyState
            title="Nenhum repasse ainda"
            description="Os repasses aparecem aqui 15 dias após cada compra confirmada."
          />
        ) : (
          <DataTable
            caption="Repasses"
            headers={['Referência', 'Valor', 'Agendado para', 'Pago em', 'Status']}
          >
            {payouts.map((payout) => (
              <tr key={payout.id}>
                <Td bold>{payout.reference ?? '—'}</Td>
                <Td bold>{formatMoney(payout.amountCents)}</Td>
                <Td muted>
                  {payout.scheduledFor.toLocaleDateString('pt-BR')}
                </Td>
                <Td muted>
                  {payout.paidAt
                    ? payout.paidAt.toLocaleDateString('pt-BR')
                    : '—'}
                </Td>
                <Td>
                  <StatusTag status={payout.status} />
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
