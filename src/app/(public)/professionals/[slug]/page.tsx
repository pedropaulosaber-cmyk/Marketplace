import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, Container, Tag } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { FavoriteButton } from '@/components/marketplace/favorite-button';
import {
  getProfessionalBySlug,
  ratingLabel,
} from '@/server/services/professional-service';
import { getSession } from '@/server/auth/session';
import { db } from '@/server/db/client';
import { formatPrice, formatRange } from '@/lib/money';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pro = await getProfessionalBySlug(slug);

  if (!pro) {
    return { title: 'Profissional não encontrado', robots: { index: false } };
  }

  const description = pro.bio.slice(0, 160);

  return {
    title: `${pro.user.name} — ${pro.title}`,
    description,
    alternates: { canonical: `/professionals/${pro.slug}` },
    openGraph: {
      type: 'profile',
      title: `${pro.user.name} · AUTOMATIZE`,
      description,
      url: `/professionals/${pro.slug}`,
    },
  };
}

export const revalidate = 600;

const AVAILABILITY: Record<
  string,
  { label: string; tone: 'ok' | 'warn' | 'neutral' }
> = {
  NOW: { label: 'Disponível agora', tone: 'ok' },
  SOON: { label: 'A partir do próximo mês', tone: 'warn' },
  FULL: { label: 'Agenda cheia', tone: 'neutral' },
};

export default async function ProfessionalPage({ params }: PageProps) {
  const { slug } = await params;
  const pro = await getProfessionalBySlug(slug);

  if (!pro) notFound();

  const session = await getSession();

  const favorited = session
    ? await db.favorite
        .findUnique({
          where: {
            userId_professionalId: {
              userId: session.id,
              professionalId: pro.id,
            },
          },
          select: { id: true },
        })
        .then(Boolean)
    : false;

  const rating = ratingLabel(pro.ratingSum, pro.ratingCount);
  const availability = AVAILABILITY[pro.availability] ?? AVAILABILITY.NOW!;

  return (
    <Container className="py-12 max-sm:py-6">
      <nav aria-label="Trilha de navegação">
        <ol className="flex items-center gap-2 text-[13px] text-muted">
          <li>
            <Link href="/professionals" className="no-underline hover:text-blue-700">
              Profissionais
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-ink">
            {pro.user.name}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid grid-cols-[1fr_340px] gap-14 max-lg:grid-cols-1 max-lg:gap-8">
        <div>
          <div className="flex items-start gap-5 max-sm:flex-col max-sm:gap-3">
            <Avatar name={pro.user.name} size={72} />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[36px] leading-tight font-extrabold max-sm:text-[26px]">
                  {pro.user.name}
                </h1>
                {pro.verified ? <Tag tone="ok">Verificado</Tag> : null}
              </div>
              <p className="mt-1 text-[17px] font-semibold text-blue-700">
                {pro.title}
              </p>
              <p className="mt-1 text-[13.5px] text-muted">
                {pro.field} · {pro.location}
              </p>
            </div>
          </div>

          <section className="mt-10">
            <h2 className="text-[22px] font-extrabold">Sobre</h2>
            <p className="mt-3 max-w-[68ch] text-[15.5px] leading-[1.7] text-[#334155]">
              {pro.bio}
            </p>
          </section>

          <section className="mt-9">
            <h2 className="text-[22px] font-extrabold">Especialidades</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {pro.skills.map((skill) => (
                <Tag key={skill} tone="neutral">
                  {skill}
                </Tag>
              ))}
            </div>
          </section>

          {pro.portfolio.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-[22px] font-extrabold">Projetos entregues</h2>
              <ul className="mt-4 flex flex-col gap-4">
                {pro.portfolio.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[14px] border border-line bg-white p-5"
                  >
                    <p className="text-[16px] font-bold">{item.title}</p>
                    <p className="mt-1 text-[14px] leading-[1.6] text-muted">
                      {item.description}
                    </p>
                    <p className="mt-3 text-[12.5px] font-semibold text-blue-700">
                      {item.meta}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pro.services.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-[22px] font-extrabold">Serviços</h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                {pro.services.map((service) => (
                  <li
                    key={service.id}
                    className="rounded-[14px] border border-line bg-white p-5"
                  >
                    <p className="text-[16px] font-bold">{service.title}</p>
                    <p className="mt-1 text-[14px] leading-[1.6] text-muted">
                      {service.description}
                    </p>
                    <p className="mt-3 text-[14px] font-extrabold">
                      A partir de {formatPrice(service.fromCents)} ·{' '}
                      {service.deliveryDays} dias
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pro.user.products.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-[22px] font-extrabold">
                Produtos no marketplace
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                {pro.user.products.map((product) => (
                  <li
                    key={product.id}
                    className="relative rounded-[14px] border border-line bg-white p-5 transition-colors hover:border-blue"
                  >
                    <Tag>{product.category.name}</Tag>
                    <p className="mt-2 text-[15px] font-bold">
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink"
                      >
                        {product.name}
                      </Link>
                    </p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-muted">
                      {product.tagline}
                    </p>
                    <p className="mt-3 text-[15px] font-extrabold">
                      {formatPrice(product.priceCents)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* --- Hire panel --- */}
        <aside className="max-lg:order-first">
          <div className="sticky top-[100px] rounded-[14px] border border-line bg-white p-6 shadow-[0_12px_28px_rgb(15_23_42/0.06)]">
            <p className="text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">
              Faixa de projeto
            </p>
            <p className="mt-2 text-[24px] leading-tight font-extrabold">
              {pro.rateMaxCents > 0
                ? formatRange(pro.rateMinCents, pro.rateMaxCents)
                : 'Sob consulta'}
            </p>

            <dl className="mt-5 flex flex-col gap-3 border-t border-line pt-5 text-[13.5px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Disponibilidade</dt>
                <dd>
                  <Tag tone={availability.tone}>{availability.label}</Tag>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Projetos entregues</dt>
                <dd className="font-bold">{pro.projectsCount}</dd>
              </div>
              {rating ? (
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Avaliação</dt>
                  <dd className="font-bold">
                    <span aria-hidden="true" className="text-star">
                      ★
                    </span>{' '}
                    {rating} ({pro.ratingCount})
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-6 flex flex-col gap-3">
              <LinkButton href="/demands/new" fullWidth size="lg">
                Solicitar proposta
              </LinkButton>

              <div className="flex items-center gap-3">
                <FavoriteButton
                  professionalId={pro.id}
                  initial={favorited}
                  label={pro.user.name}
                />
                <span className="text-[13px] text-muted">Salvar perfil</span>
              </div>
            </div>

            <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-[1.5] text-muted">
              Publique sua demanda e este profissional poderá enviar uma
              proposta com escopo, prazo e valor.
            </p>
          </div>
        </aside>
      </div>
    </Container>
  );
}
