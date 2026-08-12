'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for errors thrown in the root layout itself.
 *
 * It must render its own <html> and <body>: at this point the normal layout
 * never mounted, so nothing else is on the page. Styling is inline for the
 * same reason — the stylesheet may be exactly what failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Fatal application error:', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily:
            "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif",
          color: '#0F172A',
          background: '#FFFFFF',
        }}
      >
        <main style={{ maxWidth: '46ch' }}>
          <p
            style={{
              margin: 0,
              fontSize: '12.5px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#2563EB',
              fontWeight: 700,
            }}
          >
            Erro crítico
          </p>
          <h1
            style={{
              margin: '16px 0 0',
              fontSize: '34px',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              fontWeight: 800,
            }}
          >
            A aplicação não pôde ser carregada.
          </h1>
          <p
            style={{
              margin: '16px 0 0',
              fontSize: '16px',
              lineHeight: 1.6,
              color: '#64748B',
            }}
          >
            Registramos a falha. Recarregue a página para tentar novamente.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '28px',
              padding: '13px 22px',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'inherit',
              color: '#FFFFFF',
              background: '#2563EB',
              border: 0,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>

          {error.digest ? (
            <p
              style={{
                margin: '28px 0 0',
                fontSize: '12.5px',
                color: '#64748B',
              }}
            >
              Código: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
