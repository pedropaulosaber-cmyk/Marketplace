import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from './_components/register-form';
import { getSession } from '@/server/auth/session';

export const metadata: Metadata = {
  title: 'Criar conta',
  description: 'Crie sua conta na AUTOMATIZE.',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const params = await searchParams;
  const intentParam = typeof params.intent === 'string' ? params.intent : 'buy';

  // Only known intents are honoured; anything else falls back to "buy".
  const intent =
    intentParam === 'sell' || intentParam === 'work' ? intentParam : 'buy';

  return (
    <>
      <h1 className="text-[32px] leading-tight font-extrabold">
        Criar sua conta
      </h1>
      <p className="mt-3 text-[15px] leading-[1.6] text-muted">
        Escolha como você quer começar. Dá para mudar depois — uma conta pode
        comprar e vender.
      </p>

      <RegisterForm defaultIntent={intent} />

      <p className="mt-8 text-[14px] text-muted">
        Já tem conta?{' '}
        <Link href="/login" className="font-semibold">
          Entrar
        </Link>
      </p>
    </>
  );
}
