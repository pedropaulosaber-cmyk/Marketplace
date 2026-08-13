import type { Metadata } from 'next';
import { Container, Eyebrow, SectionHeading } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Quem somos',
  description:
    'A Automatize é o marketplace de soluções de IA que conecta quem precisa automatizar um processo com quem já sabe construir a automação certa.',
  alternates: { canonical: '/about' },
};

const WHAT_WE_DO = [
  {
    n: '01',
    t: 'Um catálogo pronto para usar',
    b: 'Automações, agentes e templates testados, publicados por criadores verificados. Sem precisar contratar ninguém para começar.',
  },
  {
    n: '02',
    t: 'Profissionais para o que é sob medida',
    b: 'Quando a prateleira não resolve, você publica a demanda e recebe proposta de quem já entregou projeto parecido — com escopo, prazo e preço registrados antes de começar.',
  },
  {
    n: '03',
    t: 'Um lugar para quem constrói vender',
    b: 'Criadores publicam uma vez e vendem quantas vezes o mercado quiser comprar, sem negociar projeto por projeto.',
  },
] as const;

const HOW_WE_DO_IT = [
  {
    t: 'Verificação antes da vitrine',
    b: 'Todo produto passa por moderação antes de ficar público. Toda avaliação vem de quem comprou de verdade.',
  },
  {
    t: 'Pagamento que só libera na entrega',
    b: 'O valor fica retido até você confirmar que recebeu o que comprou — nunca é o vendedor quem decide quando o pagamento é liberado.',
  },
  {
    t: 'Segurança como requisito, não como promessa',
    b: 'Dado sensível cifrado, sessão revogável a qualquer momento, verificação em duas etapas disponível para toda conta. Os detalhes estão documentados publicamente, não escondidos atrás de um selo.',
  },
] as const;

export default function AboutPage() {
  return (
    <Container className="py-14 max-sm:py-8">
      <SectionHeading
        eyebrow="Quem somos"
        title="O marketplace de soluções de IA para quem precisa resolver, não pesquisar."
        description="A Automatize existe para encurtar a distância entre 'minha empresa precisa automatizar isso' e 'está automatizado' — comprando pronto ou contratando quem constrói."
      />

      <section className="mt-16 max-w-[72ch]">
        <Eyebrow>Por que existimos</Eyebrow>
        <h2 className="mt-2 text-[26px] leading-tight font-extrabold max-sm:text-[21px]">
          Automação de IA virou obrigação. Encontrar quem faz direito continua difícil.
        </h2>
        <p className="mt-4 text-[15.5px] leading-[1.75] text-[#334155]">
          Toda empresa precisa automatizar alguma coisa — atendimento, vendas,
          operação, conteúdo — mas montar isso do zero exige tempo e
          conhecimento técnico que a maioria dos times não tem sobrando. Do
          outro lado, existem centenas de criadores e profissionais capazes de
          construir essa automação, espalhados sem um lugar comum onde provar
          o próprio trabalho e ser encontrados por quem precisa dele.
        </p>
        <p className="mt-4 text-[15.5px] leading-[1.75] text-[#334155]">
          A Automatize é esse lugar comum: um catálogo do que já existe
          pronto, e uma forma direta de contratar quem constrói o que ainda
          não existe.
        </p>
      </section>

      <section className="mt-16">
        <Eyebrow>O que fazemos</Eyebrow>
        <h2 className="mt-2 max-w-[60ch] text-[26px] leading-tight font-extrabold max-sm:text-[21px]">
          Três caminhos. Um lugar só.
        </h2>
        <ol className="mt-8 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
          {WHAT_WE_DO.map((step) => (
            <li
              key={step.n}
              className="rounded-[14px] border border-line bg-white p-6"
            >
              <span className="text-[13px] font-extrabold text-blue">
                {step.n}
              </span>
              <p className="mt-2 text-[17px] font-bold">{step.t}</p>
              <p className="mt-1 text-[14px] leading-[1.6] text-muted">
                {step.b}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <Eyebrow>Como fazemos</Eyebrow>
        <h2 className="mt-2 max-w-[60ch] text-[26px] leading-tight font-extrabold max-sm:text-[21px]">
          Confiança não é um adjetivo no rodapé — é a arquitetura.
        </h2>
        <div className="mt-8 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
          {HOW_WE_DO_IT.map((item) => (
            <div key={item.t}>
              <p className="text-[16px] font-bold">{item.t}</p>
              <p className="mt-2 text-[14px] leading-[1.6] text-muted">
                {item.b}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 rounded-[20px] border border-line bg-bg p-12 text-center max-sm:p-6">
        <h2 className="text-[26px] font-extrabold max-sm:text-[21px]">
          Pronto para começar?
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-[14.5px] leading-[1.6] text-muted">
          Explore o catálogo, publique uma demanda ou comece a vender o que
          você já construiu.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href="/products">Explorar produtos</LinkButton>
          <LinkButton href="/sell" variant="secondary">
            Vender na Automatize
          </LinkButton>
        </div>
      </section>
    </Container>
  );
}
