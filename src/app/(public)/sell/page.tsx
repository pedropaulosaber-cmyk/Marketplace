import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import {
  Container,
  Eyebrow,
  SectionHeading,
} from '@/components/ui/primitives';
import { EarningsCalculator } from './_components/earnings-calculator';

export const metadata: Metadata = {
  title: 'Vender na AUTOMATIZE',
  description:
    'Publique agentes, automações, workflows e templates. Comissão de 15% ' +
    'só sobre venda concluída, repasse em D+15, sem mensalidade.',
  alternates: { canonical: '/sell' },
};

const BENEFITS = [
  {
    title: 'Publique seus produtos',
    body: 'Automações, agentes, workflows, templates e prompts. Um formulário, uma revisão, catálogo.',
    paths: ['M12 5v14', 'M5 12h14'],
  },
  {
    title: 'Defina seus preços',
    body: 'Pagamento único ou versão gratuita com upgrade. Você escolhe e muda quando quiser.',
    paths: ['M12 2v20', 'M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  },
  {
    title: 'Venda globalmente',
    body: 'Compradores de qualquer nicho encontram sua solução pela busca e pelas categorias.',
    paths: [
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
      'M3 12h18',
      'M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18',
    ],
  },
  {
    title: 'Receba avaliações',
    body: 'Nota e comentário de quem realmente comprou. Prova social que trabalha sozinha.',
    paths: ['m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9Z'],
  },
  {
    title: 'Construa sua reputação',
    body: 'Selo de verificado, histórico de entregas e página pública com todo o seu portfólio.',
    paths: ['M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z', 'm9 12 2 2 4-4'],
  },
  {
    title: 'Acompanhe suas vendas',
    body: 'Receita, pedidos, conversão e visualizações no dashboard, atualizados em tempo real.',
    paths: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  },
] as const;

const COMMISSION = [
  { stat: '15%', body: 'Comissão sobre cada venda concluída. É o único valor cobrado.' },
  { stat: 'R$ 0', body: 'Mensalidade, taxa de listagem e taxa de visualização.' },
  { stat: 'D+15', body: 'Repasse após a confirmação da compra, com nota emitida pela plataforma.' },
  { stat: '14 dias', body: 'Janela de reembolso do comprador. A plataforma cobre a disputa, não você.' },
] as const;

const STEPS = [
  {
    n: '01',
    t: 'Crie',
    b: 'Desenvolva a solução do jeito que você já trabalha — n8n, Make, código ou prompt.',
  },
  {
    n: '02',
    t: 'Publique',
    b: 'Descreva o que resolve, o que exige e quanto custa. A revisão leva até 3 dias úteis.',
  },
  {
    n: '03',
    t: 'Venda',
    b: 'Apareça para empresas que já estão procurando. Você entrega, a plataforma cobra e repassa.',
  },
] as const;

const FAQ = [
  {
    q: 'Preciso dar suporte ao comprador?',
    a: 'Sim, por 90 dias dentro da plataforma. Se você não responder em 48h, o time da Automatize assume o chamado.',
  },
  {
    q: 'Quem cobre o reembolso?',
    a: 'A plataforma devolve ao comprador e resolve a disputa com você depois. O comprador nunca fica sem resposta.',
  },
  {
    q: 'Posso vender o mesmo produto fora daqui?',
    a: 'Pode. Não há exclusividade. Só não vale anunciar preço menor em outro canal.',
  },
  {
    q: 'Como funciona a verificação?',
    a: 'Documento, histórico de entregas e uma revisão técnica do primeiro produto publicado.',
  },
] as const;

export default function SellPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-bg to-white">
        <Container className="pt-[76px] pb-16 text-center max-sm:pt-10">
          <Eyebrow>Para criadores</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-[19ch] text-[62px] leading-[1.04] font-extrabold max-lg:text-[46px] max-sm:text-[32px]">
            Transforme o que você criou em uma nova fonte de{' '}
            <span className="text-blue">receita</span>.
          </h1>
          <p className="mx-auto mt-[22px] max-w-[58ch] text-[19px] leading-[1.55] text-[#475569] max-sm:text-[16px]">
            Você constrói uma vez. O marketplace vende quantas vezes forem.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 max-sm:flex-col">
            <LinkButton href="/register?intent=sell" size="lg">
              Começar a vender
            </LinkButton>
            <LinkButton href="/products" variant="secondary" size="lg">
              Ver o que já é vendido
            </LinkButton>
          </div>
        </Container>
      </section>

      <Container className="mt-4">
        <SectionHeading
          title="Você constrói uma vez. O marketplace vende quantas vezes forem."
          center
        />
        <ul className="mt-12 grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {BENEFITS.map((benefit) => (
            <li
              key={benefit.title}
              className="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-[22px] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-[3px] hover:border-blue hover:shadow-[0_12px_28px_rgb(15_23_42/0.10)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-sky">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {benefit.paths.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </span>
              <h3 className="text-[18px] font-extrabold">{benefit.title}</h3>
              <p className="text-[14px] leading-[1.6] text-muted">
                {benefit.body}
              </p>
            </li>
          ))}
        </ul>
      </Container>

      <section className="mt-24 border-y border-line bg-blue-900 py-20 max-sm:mt-14 max-sm:py-12">
        <Container>
          <h2 className="text-[38px] leading-tight font-extrabold text-white max-sm:text-[26px]">
            15% sobre a venda. Zero sobre o resto.
          </h2>
          <ul className="mt-10 grid grid-cols-4 gap-8 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {COMMISSION.map((item) => (
              <li key={item.stat}>
                <p className="text-[40px] leading-none font-extrabold text-white">
                  {item.stat}
                </p>
                <p className="mt-3 text-[14px] leading-[1.6] text-[#CBD5E1]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="mt-20 max-sm:mt-12">
        <div className="mx-auto max-w-[720px]">
          <EarningsCalculator />
        </div>
      </Container>

      <Container className="mt-24 max-sm:mt-14">
        <SectionHeading eyebrow="Como funciona" title="Publique a primeira em uma tarde." />
        <ol className="mt-10 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-[14px] border border-line bg-white p-[22px]"
            >
              <span className="text-[13px] font-extrabold text-blue">
                {step.n}
              </span>
              <p className="mt-2 text-[20px] font-extrabold">{step.t}</p>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-muted">
                {step.b}
              </p>
            </li>
          ))}
        </ol>
      </Container>

      <Container className="mt-24 max-sm:mt-14">
        <SectionHeading title="Perguntas de quem vai publicar" />
        <dl className="mt-8 flex flex-col gap-4">
          {FAQ.map((item) => (
            <div
              key={item.q}
              className="rounded-[14px] border border-line bg-white p-6 max-sm:p-4"
            >
              <dt className="text-[16px] font-bold">{item.q}</dt>
              <dd className="mt-2 text-[14.5px] leading-[1.65] text-muted">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </Container>

      <Container className="mt-20 max-sm:mt-12">
        <div className="rounded-[20px] border border-line bg-bg px-16 py-14 text-center max-sm:px-6 max-sm:py-10">
          <h2 className="mx-auto max-w-[24ch] text-[34px] leading-tight font-extrabold max-sm:text-[24px]">
            Publique seu primeiro produto ainda esta semana.
          </h2>
          <div className="mt-7">
            <LinkButton href="/register?intent=sell" size="lg">
              Criar conta de criador
            </LinkButton>
          </div>
        </div>
      </Container>
    </>
  );
}
