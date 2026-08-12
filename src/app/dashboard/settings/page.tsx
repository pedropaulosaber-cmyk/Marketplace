import type { Metadata } from 'next';
import { PageHeader, Panel } from '@/components/dashboard/panels';
import { PasswordForm } from './_components/password-form';
import { LogoutButton } from './_components/logout-button';
import { requireUser } from '@/server/auth/rbac';
import { db } from '@/server/db/client';

export const metadata: Metadata = {
  title: 'Configurações',
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireUser();

  // Active sessions give the user a way to notice a login they don't recognise.
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, lastActivityAt: true, userAgent: true },
    orderBy: { lastActivityAt: 'desc' },
    take: 10,
  });

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Segurança da conta e sessões ativas."
      />

      <Panel
        title="Alterar senha"
        description="Ao alterar a senha, todas as sessões são encerradas — inclusive esta."
        className="max-w-[560px]"
      >
        <PasswordForm />
      </Panel>

      <Panel
        title="Sessões ativas"
        description="Dispositivos com acesso à sua conta agora."
        className="max-w-[680px]"
      >
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-start justify-between gap-4 border-b border-line pb-3 text-[13.5px] last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {session.userAgent
                    ? session.userAgent.slice(0, 70)
                    : 'Dispositivo desconhecido'}
                </p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Iniciada em {session.createdAt.toLocaleDateString('pt-BR')} ·
                  Última atividade{' '}
                  {session.lastActivityAt.toLocaleDateString('pt-BR')}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[12.5px] leading-[1.5] text-muted">
          Não reconhece um acesso? Altere sua senha — isso encerra todas as
          sessões imediatamente.
        </p>
      </Panel>

      <Panel title="Sair" className="max-w-[560px]">
        <p className="text-[14px] leading-[1.6] text-muted">
          Encerra esta sessão neste dispositivo.
        </p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </Panel>
    </>
  );
}
