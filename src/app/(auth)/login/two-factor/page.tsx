import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pendingChallengeUser } from '@/server/services/two-factor-service';
import { ChallengeForm } from './_components/challenge-form';

export const metadata: Metadata = {
  title: 'Verificação em duas etapas',
  robots: { index: false, follow: false },
};

// Reads a cookie and database state on every request; nothing here is
// cacheable, and a cached render would leak one visitor's challenge state.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Same open-redirect guard the login action applies. */
function safeNext(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '/dashboard';
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // No live challenge means no password was verified — there is nothing to
  // complete, so this page must not be reachable as a standalone step.
  const pending = await pendingChallengeUser();
  if (!pending) redirect('/login');

  const params = await searchParams;

  return (
    <>
      <h1 className="text-[32px] leading-tight font-extrabold">
        Verificação em duas etapas
      </h1>

      <p className="mt-3 text-[15px] leading-[1.6] text-muted">
        Entrando como <strong className="text-ink">{pending.email}</strong>.
        Informe o código de 6 dígitos do seu aplicativo autenticador para
        concluir.
      </p>

      <ChallengeForm next={safeNext(params.next)} />

      <p className="mt-6 border-t border-line pt-5 text-[13px] leading-[1.6] text-muted">
        Perdeu o acesso ao aplicativo? Use um código de recuperação no campo
        acima — eles funcionam uma vez cada. Sem os códigos, a recuperação
        exige verificação de identidade pelo{' '}
        <Link href="/login" className="font-semibold text-blue-700">
          suporte
        </Link>
        .
      </p>
    </>
  );
}
