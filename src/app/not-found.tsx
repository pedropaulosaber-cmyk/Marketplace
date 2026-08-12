import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

export const metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-20 py-10 max-lg:px-10 max-sm:px-5">
      <Logo />

      <main id="main" className="flex flex-1 items-center">
        <div className="max-w-[52ch]">
          <p className="eyebrow">Erro 404</p>
          <h1 className="mt-4 text-[46px] leading-[1.08] font-extrabold max-sm:text-[30px]">
            Não encontramos esta página.
          </h1>
          <p className="mt-4 text-[17px] leading-[1.6] text-muted max-sm:text-[15px]">
            O endereço pode ter mudado, ou o produto que você procura não está
            mais publicado. Continue pelo catálogo — provavelmente existe algo
            que resolve o mesmo problema.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/products" size="lg">
              Explorar produtos
            </LinkButton>
            <LinkButton href="/" variant="secondary" size="lg">
              Voltar para a home
            </LinkButton>
          </div>

          <p className="mt-8 text-[14px] text-muted">
            Procurando um especialista?{' '}
            <Link href="/professionals" className="font-semibold">
              Ver profissionais
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
