import type { Metadata } from 'next';
import { EmptyState, StatusTag, Tag } from '@/components/ui/primitives';
import { DataTable, PageHeader, Panel, Td } from '@/components/dashboard/panels';
import { UserRowActions } from './_components/user-row-actions';
import { listUsers } from '@/server/services/admin-service';

export const metadata: Metadata = {
  title: 'Usuários',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Comprador',
  CREATOR: 'Criador',
  PROFESSIONAL: 'Profissional',
  ADMIN: 'Admin',
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : undefined;

  const statusParam = typeof params.status === 'string' ? params.status : undefined;
  const status =
    statusParam === 'ACTIVE' ||
    statusParam === 'SUSPENDED' ||
    statusParam === 'BANNED'
      ? statusParam
      : undefined;

  const users = await listUsers(query, status);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Gerencie contas, papéis e bloqueios. Toda ação aqui é registrada na auditoria."
      />

      <Panel title={`${users.length} ${users.length === 1 ? 'conta' : 'contas'}`}>
        {users.length === 0 ? (
          <EmptyState
            title="Nenhum usuário encontrado"
            description="Ajuste a busca ou os filtros."
          />
        ) : (
          <DataTable
            caption="Usuários da plataforma"
            headers={['Nome', 'E-mail', 'Papéis', 'Produtos', 'Pedidos', 'Status', 'Ações']}
            minWidth={980}
          >
            {users.map((user) => (
              <tr key={user.id}>
                <Td bold>{user.name}</Td>
                <Td muted>{user.email}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {user.roles.map(({ role }) => (
                      <Tag
                        key={role}
                        tone={role === 'ADMIN' ? 'warn' : 'neutral'}
                      >
                        {ROLE_LABEL[role] ?? role}
                      </Tag>
                    ))}
                  </span>
                </Td>
                <Td>{user._count.products}</Td>
                <Td>{user._count.orders}</Td>
                <Td>
                  <StatusTag status={user.status} />
                </Td>
                <Td>
                  <UserRowActions
                    userId={user.id}
                    status={user.status}
                    roles={user.roles.map((r) => r.role)}
                  />
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
