import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LinkButton } from '@/components/ui/button';
import {
  CardSkeleton,
  Container,
  Eyebrow,
  SectionHeading,
  Tag,
  Thumb,
} from '@/components/ui/primitives';
import { ProductCard } from '@/components/marketplace/product-card';
import { getFeaturedProducts } from '@/server/services/product-service';
import { getFeaturedProfessionals } from '@/server/services/professional-service';
import { SolutionMarquee } from './_components/solution-marquee';
import { formatRange } from '@/lib/money';
import { resilient } from '@/lib/resilient';

export const metadata: Metadata = {
  title: 'AUTOMATIZE — Marketplace de soluções de IA',
  description:
    'Encontre soluções de IA, compre produtos prontos ou contrate especialistas ' +
    'para construir o que sua empresa precisa.',
  alternates: { canonical: '/' },
};

// Forced dynamic rather than ISR (`revalidate`): the shared layout already
// reads the session cookie on every request, which makes this route dynamic
// in practice. Being explicit here also means Next never attempts to
// pre-render this page at *build* time — which matters because the featured
// sections query the database, and a build must succeed even before a real
// DATABASE_URL is configured (see src/lib/env.ts).
export const dynamic = 'force-dynamic';

const PATHS = [
  {
    n: '01',
    kicker: 'COMPRE',
    title: 'Encontre soluções prontas',
    body: 'Agentes, automações, workflows, templates e ferramentas criadas para resolver problemas reais.',
    cta: 'Explorar produtos',
    href: '/products',
  },
  {
    n: '02',
    kicker: 'CONTRATE',
    title: 'Precisa de algo personalizado?',
    body: 'Publique sua necessidade e receba propostas de profissionais especializados.',
    cta: 'Encontrar profissional',
    href: '/professionals',
  },
  {
    n: '03',
    kicker: 'VENDA',
    title: 'Transforme sua criação em produto',
    body: 'Publique suas soluções, defina seu preço e alcance novos compradores.',
    cta: 'Começar a vender',
    href: '/sell',
  },
] as const;

const TRUST = [
  'Criadores verificados',
  'Avaliações de compradores',
  'Produtos avaliados',
  'Pagamentos seguros',
  'Histórico do profissional',
  'Suporte',
  'Transparência nas propostas',
] as const;

const JOURNEYS = [
  {
    title: 'Para compradores',
    steps: [
      { n: '01', t: 'Encontre', b: 'Descreva o problema ou pesquise uma solução.' },
      { n: '02', t: 'Compare', b: 'Veja produtos, profissionais, avaliações e preços.' },
      {
        n: '03',
        t: 'Resolva',
        b: 'Compre uma solução pronta ou contrate alguém para construir.',
      },
    ],
  },
  {
    title: 'Para criadores',
    steps: [
      { n: '01', t: 'Crie', b: 'Desenvolva uma solução.' },
      { n: '02', t: 'Publique', b: 'Coloque seu produto no marketplace.' },
      { n: '03', t: 'Venda', b: 'Alcance compradores que precisam daquilo.' },
    ],
  },
] as const;

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <Hero />
      <SolutionMarquee />
      <Paths />

      <Container className="mt-24 max-sm:mt-16">
        <SectionHeading
          eyebrow="Em destaque"
          title="O que você precisa automatizar?"
          description="Soluções prontas, publicadas por criadores verificados e avaliadas por quem já comprou."
        />
        <Suspense fallback={<ProductGridSkeleton />}>
          <FeaturedProducts />
        </Suspense>
      </Container>

      <Trust />

      <Container className="mt-24 max-sm:mt-16">
        <SectionHeading
          eyebrow="Contrate"
          title="Encontre quem pode construir sua próxima automação."
          description="Especialistas com portfólio, histórico de entregas e avaliações públicas."
        />
        <Suspense fallback={<ProductGridSkeleton count={3} />}>
          <FeaturedProfessionals />
        </Suspense>
      </Container>

      <Journeys />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-gradient-to-b from-bg to-white pb-2">
      <Container className="pt-[76px] text-center max-sm:pt-10">
        <Eyebrow>O marketplace de soluções de IA</Eyebrow>

        <h1 className="mx-auto mt-5 max-w-[17ch] text-[72px] leading-[1.02] font-extrabold max-lg:text-[52px] max-sm:text-[34px]">
          Sua próxima <span className="text-blue">automação</span> já pode estar
          pronta.
        </h1>

        <p className="mx-auto mt-[22px] max-w-[60ch] text-[19px] leading-[1.55] text-[#475569] max-sm:text-[16px]">
          Encontre soluções de IA, compre produtos prontos ou contrate
          especialistas para construir o que sua empresa precisa.
        </p>

        <div className="mt-[30px] flex flex-wrap justify-center gap-3 max-sm:flex-col">
          <LinkButton href="/products" size="lg">
            Explorar soluções →
          </LinkButton>
          <LinkButton href="/demands/new" variant="secondary" size="lg">
            Preciso de uma solução personalizada
          </LinkButton>
        </div>

        <p className="mt-4 text-[13.5px] text-muted">
          Soluções prontas para problemas reais de empresas. Conectamos você
          com o melhor do mercado de IA do Brasil.
        </p>
      </Container>

      <BrowserMockup />
    </section>
  );
}

/**
 * The framed catalog preview from the Canvas hero. Purely decorative, so it is
 * hidden from assistive technology and dropped entirely on small screens where
 * it would be illegible.
 */
/**
 * Catalogue sample shown inside the hero frame. Illustrative copy rather than
 * live data: the hero renders above the fold on the highest-traffic page, and
 * it must never wait on — or fail with — a database query.
 */
const PREVIEW_PRODUCTS = [
  {
    name: 'AI Sales Agent',
    category: 'AI Agents',
    tagline: 'Qualifica lead e devolve o resumo direto no CRM.',
    rating: '4,9',
    sales: '312 vendas',
    price: 'R$ 149',
  },
  {
    name: 'WhatsApp Support Agent',
    category: 'Chatbots',
    tagline: 'Primeiro atendimento e encaminhamento sem fila.',
    rating: '4,8',
    sales: '268 vendas',
    price: 'R$ 199',
  },
  {
    name: 'Lead Qualification Flow',
    category: 'Workflows',
    tagline: 'Distribui o lead certo para o vendedor certo.',
    rating: '4,7',
    sales: '196 vendas',
    price: 'R$ 89',
  },
  {
    name: 'Contract Review Agent',
    category: 'AI Agents',
    tagline: 'Lê o contrato e aponta risco por cláusula.',
    rating: '5,0',
    sales: '134 vendas',
    price: 'R$ 249',
  },
  {
    name: 'Meeting Notes Automation',
    category: 'Automações',
    tagline: 'Decisões e tarefas atribuídas ao fim da call.',
    rating: '4,8',
    sales: '741 vendas',
    price: 'Grátis',
  },
  {
    name: 'Ops Report Template',
    category: 'Templates',
    tagline: 'Relatório que se preenche sozinho toda segunda.',
    rating: '4,6',
    sales: '203 vendas',
    price: 'R$ 79',
  },
] as const;

function BrowserMockup() {
  const categories = [
    'AI Agents',
    'Automações',
    'Workflows',
    'Prompts',
    'Templates',
    'Chatbots',
  ];

  return (
    <div
      aria-hidden="true"
      className="mx-auto mt-11 max-w-[1240px] px-20 max-lg:px-10 max-sm:hidden"
    >
      <div className="overflow-hidden rounded-t-[16px] border border-line bg-white shadow-[0_-2px_60px_rgb(15_23_42/0.12)]">
        <div className="flex items-center gap-[10px] border-b border-line bg-bg px-[18px] py-3">
          <span className="h-[9px] w-[9px] rounded-full bg-[#CBD5E1]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#CBD5E1]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#CBD5E1]" />
          <span className="ml-[10px] text-[12px] text-muted">
            automatize.com.br/produtos
          </span>
        </div>

        <div className="grid min-h-[430px] grid-cols-[210px_1fr]">
          <div className="border-r border-line bg-[#FCFDFE] p-5">
            <p className="mb-3 text-[11px] font-extrabold tracking-[0.12em] text-muted uppercase">
              Categorias
            </p>
            <div className="flex flex-col gap-[3px]">
              {categories.map((c, i) => (
                <span
                  key={c}
                  className={
                    i === 0
                      ? 'rounded-[7px] bg-sky px-[10px] py-[7px] text-[13px] font-bold text-blue-700'
                      : 'px-[10px] py-[7px] text-[13px] text-[#475569]'
                  }
                >
                  {c}
                </span>
              ))}
            </div>

            <p className="mt-[22px] mb-3 text-[11px] font-extrabold tracking-[0.12em] text-muted uppercase">
              Preço
            </p>
            <div className="flex flex-col gap-2 text-[13px] text-[#475569]">
              <span>Até R$ 99</span>
              <span>R$ 100 – 199</span>
              <span>R$ 200+</span>
            </div>
          </div>

          <div className="px-[22px] py-5">
            <div className="mb-[14px] flex items-center gap-[10px]">
              <span className="flex flex-1 items-center gap-[9px] rounded-[9px] border border-line px-[13px] py-[10px]">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.2-3.2" />
                </svg>
                <span className="text-[13px] text-muted">
                  Buscar produtos, criadores ou integrações
                </span>
              </span>
              <span className="rounded-[9px] border border-line px-[14px] py-[10px] text-[12.5px] text-[#475569]">
                Mais vendidos ▾
              </span>
            </div>

            <div className="grid grid-cols-3 gap-[14px]">
              {PREVIEW_PRODUCTS.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col gap-2 rounded-[12px] border border-line p-[14px]"
                >
                  <Thumb className="h-[78px] w-full" />
                  <span className="w-fit rounded-[6px] bg-sky px-2 py-[3px] text-[10.5px] font-bold text-blue-700">
                    {item.category}
                  </span>
                  <span className="text-[13px] leading-tight font-extrabold text-ink">
                    {item.name}
                  </span>
                  <span className="text-[11px] leading-[1.45] text-muted">
                    {item.tagline}
                  </span>
                  <span className="mt-1 flex items-center justify-between border-t border-line pt-2">
                    <span className="text-[10.5px] text-muted">
                      <span className="text-star">★</span> {item.rating} ·{' '}
                      {item.sales}
                    </span>
                    <span className="text-[12px] font-extrabold text-ink">
                      {item.price}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Paths() {
  return (
    <Container className="mt-24 max-sm:mt-16">
      <SectionHeading
        eyebrow="Como funciona"
        title="Três caminhos. Um lugar só."
        center
      />

      <ul className="mt-12 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
        {PATHS.map((path) => (
          <li
            key={path.n}
            className="flex flex-col gap-[10px] rounded-[14px] border border-line bg-white p-[22px] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-[3px] hover:border-blue hover:shadow-[0_12px_28px_rgb(15_23_42/0.10)]"
          >
            <span className="text-[13px] font-extrabold text-blue">{path.n}</span>
            <Eyebrow>{path.kicker}</Eyebrow>
            <h3 className="mt-1 text-[21px] leading-tight font-extrabold">
              {path.title}
            </h3>
            <p className="flex-1 text-[14.5px] leading-[1.6] text-muted">
              {path.body}
            </p>
            <Link
              href={path.href}
              className="mt-2 text-[15px] font-semibold text-blue-700 no-underline hover:text-blue-900"
            >
              {path.cta} →
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}

async function FeaturedProducts() {
  const { data: products, unavailable } = await resilient(
    () => getFeaturedProducts(8),
    [],
    'home.featuredProducts'
  );

  if (unavailable) {
    return (
      <p className="mt-10 rounded-[14px] border border-dashed border-line bg-bg px-6 py-12 text-center text-[14.5px] text-muted">
        Não foi possível carregar os produtos em destaque agora.
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="mt-10 rounded-[14px] border border-dashed border-line bg-bg px-6 py-12 text-center text-[14.5px] text-muted">
        Os primeiros produtos aparecem aqui assim que forem publicados.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-10 grid grid-cols-4 gap-[14px] max-lg:grid-cols-2 max-sm:grid-cols-1">
        {products.map((product) => (
          <li key={product.id} className="contents">
            <ProductCard product={product} showFavorite={false} />
          </li>
        ))}
      </ul>
      <div className="mt-8 text-center">
        <LinkButton href="/products" variant="secondary">
          Ver todos os produtos
        </LinkButton>
      </div>
    </>
  );
}

async function FeaturedProfessionals() {
  const { data: pros, unavailable } = await resilient(
    () => getFeaturedProfessionals(3),
    [],
    'home.featuredProfessionals'
  );

  if (unavailable) {
    return (
      <p className="mt-10 rounded-[14px] border border-dashed border-line bg-bg px-6 py-12 text-center text-[14.5px] text-muted">
        Não foi possível carregar os profissionais em destaque agora.
      </p>
    );
  }

  if (pros.length === 0) {
    return (
      <p className="mt-10 rounded-[14px] border border-dashed border-line bg-bg px-6 py-12 text-center text-[14.5px] text-muted">
        Os primeiros profissionais verificados aparecem aqui em breve.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-10 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
        {pros.map((pro) => (
          <li
            key={pro.id}
            className="relative flex flex-col gap-[10px] rounded-[14px] border border-line bg-white p-[22px] transition-colors hover:border-blue"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-[17px] font-extrabold">
                <Link
                  href={`/professionals/${pro.slug}`}
                  className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink"
                >
                  {pro.user.name}
                </Link>
              </h3>
              {pro.verified ? <Tag tone="ok">Verificado</Tag> : null}
            </div>
            <p className="text-[13.5px] font-semibold text-blue-700">{pro.title}</p>
            <p className="line-clamp-3 flex-1 text-[14px] leading-[1.6] text-muted">
              {pro.bio}
            </p>
            <div className="flex flex-wrap gap-[6px]">
              {pro.skills.slice(0, 4).map((skill) => (
                <Tag key={skill} tone="neutral">
                  {skill}
                </Tag>
              ))}
            </div>
            <p className="border-t border-line pt-[10px] text-[13px] font-semibold">
              {pro.rateMaxCents > 0
                ? formatRange(pro.rateMinCents, pro.rateMaxCents)
                : 'Sob consulta'}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-8 text-center">
        <LinkButton href="/professionals" variant="secondary">
          Ver todos os profissionais
        </LinkButton>
      </div>
    </>
  );
}

function Trust() {
  return (
    <section className="mt-24 border-y border-line bg-bg py-20 max-sm:mt-16 max-sm:py-14">
      <Container>
        <SectionHeading
          eyebrow="Confiança"
          title="Feito para comprar com confiança."
          description="Cada compra passa por verificação, avaliação real e pagamento protegido."
          center
        />
        <ul className="mx-auto mt-10 flex max-w-[900px] flex-wrap justify-center gap-3">
          {TRUST.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-full border border-line bg-white px-[18px] py-[11px] text-[14px] font-semibold"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Journeys() {
  return (
    <Container className="mt-24 max-sm:mt-16">
      <div className="grid grid-cols-2 gap-14 max-lg:grid-cols-1 max-lg:gap-10">
        {JOURNEYS.map((journey) => (
          <div key={journey.title}>
            <h2 className="text-[26px] font-extrabold">{journey.title}</h2>
            <ol className="mt-6 flex flex-col gap-5">
              {journey.steps.map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sky text-[13px] font-extrabold text-blue-700">
                    {step.n}
                  </span>
                  <div>
                    <p className="text-[16px] font-bold">{step.t}</p>
                    <p className="mt-1 text-[14px] leading-[1.6] text-muted">
                      {step.b}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Container>
  );
}

function FinalCta() {
  return (
    <Container className="mt-24 max-sm:mt-16">
      <div className="rounded-[20px] bg-blue-900 px-16 py-16 text-center max-sm:px-6 max-sm:py-10">
        <h2 className="mx-auto max-w-[22ch] text-[40px] leading-[1.1] font-extrabold text-white max-sm:text-[26px]">
          O que você precisa automatizar já pode estar pronto.
        </h2>
        <p className="mx-auto mt-4 max-w-[54ch] text-[17px] leading-[1.55] text-[#CBD5E1] max-sm:text-[15px]">
          Explore o catálogo ou publique sua demanda e receba propostas de
          especialistas.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 max-sm:flex-col">
          <LinkButton href="/products" size="lg">
            Explorar soluções
          </LinkButton>
          <LinkButton
            href="/demands/new"
            size="lg"
            variant="secondary"
            className="border-transparent bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            Publicar uma demanda
          </LinkButton>
        </div>
      </div>
    </Container>
  );
}

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className={
        count === 3
          ? 'mt-10 grid grid-cols-3 gap-6 max-lg:grid-cols-1'
          : 'mt-10 grid grid-cols-4 gap-[14px] max-lg:grid-cols-2 max-sm:grid-cols-1'
      }
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Organization + WebSite structured data, so search engines get a rich result. */
function StructuredData() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AUTOMATIZE',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    description:
      'Marketplace de soluções de IA: agentes, automações, workflows e templates.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      // Serialised from a literal we control — no user input reaches this.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
