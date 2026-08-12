import type { Metadata } from 'next';
import { PageHeader, Panel } from '@/components/dashboard/panels';
import { ProfileForm } from './_components/profile-form';
import { requireUser } from '@/server/auth/rbac';
import { db } from '@/server/db/client';

export const metadata: Metadata = {
  title: 'Perfil',
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const user = await requireUser();

  const profile = await db.profile.findUnique({
    where: { userId: user.id },
    select: {
      headline: true,
      bio: true,
      company: true,
      website: true,
      location: true,
    },
  });

  return (
    <>
      <PageHeader
        title="Perfil"
        description="Como você aparece para compradores e clientes na plataforma."
      />

      <Panel title="Dados públicos" className="max-w-[680px]">
        <ProfileForm
          defaults={{
            name: user.name,
            headline: profile?.headline ?? '',
            bio: profile?.bio ?? '',
            company: profile?.company ?? '',
            website: profile?.website ?? '',
            location: profile?.location ?? '',
          }}
        />
      </Panel>

      <Panel title="Conta" className="max-w-[680px]">
        <dl className="flex flex-col gap-3 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">E-mail</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Papéis</dt>
            <dd className="font-medium">
              {user.roles
                .map(
                  (role) =>
                    ({
                      BUYER: 'Comprador',
                      CREATOR: 'Criador',
                      PROFESSIONAL: 'Profissional',
                      ADMIN: 'Administrador',
                    })[role]
                )
                .join(', ')}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-[12.5px] leading-[1.5] text-muted">
          Para alterar o e-mail ou solicitar um novo papel, fale com o suporte.
        </p>
      </Panel>
    </>
  );
}
