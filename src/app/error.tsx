'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo';

/**
 * Route-level error boundary.
 *
 * Next.js gives the client only an opaque `digest` for server errors — the
 * real message and stack stay on the server. That is deliberate, and this
 * screen surfaces the digest so a user can quote it to support without us
 * leaking internals.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side errors never reach the server logger on their own.
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col px-20 py-10 max-lg:px-10 max-sm:px-5">
      <div className="flex items-center gap-[10px]">
        <LogoMark size={24} />
        <span className="text-[17px] font-extrabold tracking-[-0.045em]">
          AUTOMATIZE
        </span>
      </div>

      <main id="main" className="flex flex-1 items-center">
        <div className="max-w-[52ch]">
          <p className="eyebrow">Algo deu errado</p>
          <h1 className="mt-4 text-[42px] leading-[1.08] font-extrabold max-sm:text-[28px]">
            Não conseguimos carregar esta página.
          </h1>
          <p className="mt-4 text-[17px] leading-[1.6] text-muted max-sm:text-[15px]">
            O erro foi registrado e nossa equipe já pode investigá-lo. Tente
            novamente — se persistir, volte em alguns minutos.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={reset}>
              Tentar novamente
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Voltar para a home
            </Button>
          </div>

          {error.digest ? (
            <p className="mt-8 text-[12.5px] text-muted">
              Código do erro:{' '}
              <code className="font-mono font-semibold">{error.digest}</code>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
