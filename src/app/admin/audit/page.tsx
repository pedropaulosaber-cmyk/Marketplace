import type { Metadata } from 'next';
import { EmptyState, Tag } from '@/components/ui/primitives';
import { DataTable, PageHeader, Panel, Td } from '@/components/dashboard/panels';
import { listAuditLog } from '@/server/services/admin-service';

export const metadata: Metadata = {
  title: 'Auditoria',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Actions that change money, access or publication state are highlighted. */
const SENSITIVE = new Set([
  'user.suspended',
  'user.role_granted',
  'user.role_revoked',
  'order.refunded',
  'payment.webhook_rejected',
  'product.rejected',
  'review.removed',
]);

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const entityType =
    typeof params.entityType === 'string' ? params.entityType : undefined;

  const entries = await listAuditLog(entityType);

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Registro imutável de ações administrativas e eventos financeiros. Nada aqui é editado ou removido pela aplicação."
      />

      <Panel title={`${entries.length} eventos recentes`}>
        {entries.length === 0 ? (
          <EmptyState
            title="Nenhum evento registrado"
            description="As ações auditáveis aparecem aqui assim que acontecerem."
          />
        ) : (
          <DataTable
            caption="Registro de auditoria"
            headers={['Quando', 'Ação', 'Entidade', 'Autor', 'Detalhes']}
            minWidth={940}
          >
            {entries.map((entry) => (
              <tr key={entry.id}>
                <Td muted>
                  {entry.createdAt.toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </Td>
                <Td>
                  <Tag tone={SENSITIVE.has(entry.action) ? 'warn' : 'neutral'}>
                    {entry.action}
                  </Tag>
                </Td>
                <Td muted>
                  {entry.entityType}
                  <span className="ml-1 font-mono text-[11.5px] opacity-70">
                    {entry.entityId.slice(-8)}
                  </span>
                </Td>
                <Td muted>{entry.actor?.name ?? 'sistema'}</Td>
                <Td muted className="max-w-[320px] truncate">
                  {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
