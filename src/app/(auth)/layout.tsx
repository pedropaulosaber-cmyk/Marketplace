import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

/**
 * Authentication shell.
 *
 * Deliberately chrome-free: no nav, no footer, nothing competing with the one
 * action on the page. A split layout carries the brand and the reasons to
 * sign up on the right, on screens wide enough for it.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-[1fr_46%] max-lg:grid-cols-1">
      <div className="flex flex-col px-20 py-10 max-lg:px-10 max-sm:px-5 max-sm:py-6">
        <Logo />
        <main id="main" className="flex flex-1 items-center py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
        <p className="text-[12.5px] text-muted">
          <Link href="/" className="no-underline hover:text-blue-700">
            ← Voltar para a home
          </Link>
        </p>
      </div>

      <aside
        aria-hidden="true"
        className="flex flex-col justify-center bg-blue-900 px-16 py-20 max-lg:hidden"
      >
        <p className="text-[12.5px] font-bold tracking-[0.16em] text-blue uppercase">
          O marketplace de soluções de IA
        </p>
        <p className="mt-6 max-w-[18ch] text-[42px] leading-[1.08] font-extrabold text-white">
          Sua próxima automação já pode estar pronta.
        </p>
        <ul className="mt-10 flex flex-col gap-4">
          {[
            'Reembolso integral em até 14 dias',
            'Criadores verificados por documento e histórico',
            'Propostas de especialistas com avaliação pública',
            'Pagamento processado com segurança',
          ].map((item) => (
            <li
              key={item}
              className="flex gap-3 text-[15px] leading-[1.5] text-[#CBD5E1]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-[3px] flex-none"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
