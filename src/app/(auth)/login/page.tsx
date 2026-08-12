import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from './_components/login-form';
import { FormSuccess } from '@/components/ui/field';
import { getSession } from '@/server/auth/session';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Entre na sua conta AUTOMATIZE.',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : undefined;
  const reason = typeof params.reason === 'string' ? params.reason : undefined;

  return (
    <>
      <h1 className="text-[32px] leading-tight font-extrabold">
        Entrar na Automatize
      </h1>
      <p className="mt-3 text-[15px] leading-[1.6] text-muted">
        Compre soluções prontas, publique demandas e acompanhe a implantação num
        lugar só.
      </p>

      {reason === 'password-changed' ? (
        <div className="mt-6">
          <FormSuccess message="Senha alterada. Entre novamente com a nova senha." />
        </div>
      ) : null}

      <LoginForm next={next} />

      <p className="mt-8 text-[14px] text-muted">
        Ainda não tem conta?{' '}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
          className="font-semibold"
        >
          Criar conta
        </Link>
      </p>
    </>
  );
}
