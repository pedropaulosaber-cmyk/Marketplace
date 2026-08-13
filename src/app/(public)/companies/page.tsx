import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, Container, EmptyState, ErrorState, SectionHeading, Tag } from '@/components/ui/primitives';
import { listCompanies } from '@/server/services/company-service';
import { resilient } from '@/lib/resilient';
import { isDatabaseConfigured } from '@/lib/env';
import { listDemoCompanies } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Empresas parceiras',
  description:
    'Empresas parceiras da Automatize com storefront próprio no marketplace — automações verificadas, publicadas sob o nome de quem as constrói.',
  alternates: { canonical: '/companies' },
};

// Small, editorially-curated list — cheap enough to render fresh on every
// request rather than caching a page that changes rarely but unpredictably.
export const dynamic = 'force-dynamic';

interface CompanyCardData {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  location: string | null;
  featured: boolean;
}

export default async function CompaniesPage() {
  const companies = isDatabaseConfigured
    ? await loadRealCompanies()
    : { items: listDemoCompanies(), unavailable: false };

  return (
    <Container className="py-14 max-sm:py-8">
      <SectionHeading
        eyebrow="Parceiros"
        title="Empresas parceiras da Automatize."
        description="Estúdios e empresas que publicam automações verificadas no marketplace, com destaque próprio para o portfólio de cada uma."
      />

      <div className="mt-10">
        {companies.unavailable ? (
          <ErrorState description="Não conseguimos carregar as empresas parceiras agora. Tente novamente em instantes." />
        ) : companies.items.length === 0 ? (
          <EmptyState
            title="Nenhuma empresa parceira ainda"
            description="Em breve empresas parceiras terão destaque aqui, com seus produtos reunidos em um só lugar."
          />
        ) : (
          <ul className="grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {companies.items.map((company: CompanyCardData) => (
              <li
                key={company.id}
                className="group relative flex flex-col gap-3 rounded-[14px] border border-line bg-white p-[22px] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-[3px] hover:border-blue hover:shadow-[0_12px_28px_rgb(15_23_42/0.10)]"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={company.name} size={48} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16.5px] font-extrabold">
                        <Link
                          href={`/companies/${company.slug}`}
                          className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink"
                        >
                          {company.name}
                        </Link>
                      </h3>
                      {company.featured ? <Tag tone="ok">Parceiro em destaque</Tag> : null}
                    </div>
                    {company.location ? (
                      <p className="mt-[2px] text-[12.5px] text-muted">{company.location}</p>
                    ) : null}
                  </div>
                </div>

                <p className="line-clamp-3 flex-1 text-[14px] leading-[1.6] text-muted">
                  {company.tagline}
                </p>

                <p className="border-t border-line pt-3 text-[12.5px] font-semibold text-blue-700">
                  Ver produtos →
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}

async function loadRealCompanies(): Promise<{
  items: CompanyCardData[];
  unavailable: boolean;
}> {
  const { data, unavailable } = await resilient(listCompanies, [], 'companies.listing');
  return { items: data, unavailable };
}
