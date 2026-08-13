import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';
import { Container } from '@/components/ui/primitives';

/**
 * Site footer. Column structure and labels come from the Canvas design.
 */

const COLUMNS = [
  {
    title: 'Marketplace',
    links: [
      { label: 'Explorar produtos', href: '/products' },
      { label: 'Categorias', href: '/products' },
      { label: 'Mais vendidos', href: '/products?sort=sold' },
      { label: 'Novidades', href: '/products?sort=new' },
      { label: 'Empresas parceiras', href: '/companies' },
    ],
  },
  {
    title: 'Profissionais',
    links: [
      { label: 'Encontrar profissionais', href: '/professionals' },
      { label: 'Publicar demanda', href: '/demands/new' },
      { label: 'Como funciona', href: '/demands' },
    ],
  },
  {
    title: 'Criadores',
    links: [
      { label: 'Vender produtos', href: '/sell' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Central do criador', href: '/dashboard/products' },
      { label: 'Criadores fundadores', href: '/founders' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre', href: '/about' },
      { label: 'Contato', href: '/sell' },
      { label: 'Segurança', href: '/sell' },
      { label: 'Termos', href: '/sell' },
      { label: 'Privacidade', href: '/sell' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-bg pt-16 pb-10 max-sm:mt-16 max-sm:pb-28">
      <Container>
        <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] gap-10 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-8">
          <div>
            <div className="flex items-center gap-[10px]">
              <LogoMark size={24} />
              <span className="text-[17px] font-extrabold tracking-[-0.045em]">
                AUTOMATIZE
              </span>
            </div>
            <p className="mt-4 max-w-[34ch] text-[13.5px] leading-[1.6] text-muted">
              O marketplace de soluções de IA. Compre automações prontas ou
              contrate quem pode construir a sua.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">
                {column.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-[10px]">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13.5px] text-[#475569] no-underline hover:text-blue-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex items-center justify-between border-t border-line pt-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <p className="text-[12.5px] text-muted">
            © {new Date().getFullYear()} AUTOMATIZE. Todos os direitos
            reservados.
          </p>
          <p className="text-[12.5px] text-muted">
            Pagamentos processados com segurança · Reembolso em até 14 dias
          </p>
        </div>
      </Container>
    </footer>
  );
}
