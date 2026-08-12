/**
 * Fictional catalogue shown when no database is configured.
 *
 * `pnpm db:seed` populates a real database with a larger, richer version of
 * this same fictional content — this file exists for the gap before that
 * database is connected at all. Every page that reads it checks
 * `isDatabaseConfigured` first, so the moment a real `DATABASE_URL` is set
 * this module stops being reachable in production; nothing here can ever
 * shadow real data.
 *
 * Deliberately not `server-only`: the data itself is public marketing copy,
 * and keeping this importable from anywhere (including a future client
 * component or a test) costs nothing.
 */

import type { ProductFilters, ProfessionalFilters } from '@/lib/validation/schemas';

export interface DemoImage {
  id: string;
  alt: string;
}

export interface DemoReview {
  id: string;
  authorName: string;
  authorHeadline: string | null;
  rating: number;
  comment: string;
}

export interface DemoProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  descriptionMd: string;
  priceCents: number;
  currency: string;
  categoryName: string;
  authorName: string;
  authorVerified: boolean;
  authorProductsCount: number;
  ratingSum: number;
  ratingCount: number;
  salesCount: number;
  tags: string[];
  benefits: string[];
  included: string[];
  requirements: string[];
  compat: string[];
  integrations: string[];
  videoUrl: string | null;
  images: DemoImage[];
  reviews: DemoReview[];
}

export interface DemoPortfolioItem {
  id: string;
  title: string;
  description: string;
  meta: string;
}

export interface DemoService {
  id: string;
  title: string;
  description: string;
  fromCents: number;
  deliveryDays: number;
}

export interface DemoProfessional {
  id: string;
  slug: string;
  name: string;
  title: string;
  field: string;
  bio: string;
  location: string;
  skills: string[];
  rateMinCents: number;
  rateMaxCents: number;
  availability: 'NOW' | 'SOON' | 'FULL';
  verified: boolean;
  ratingSum: number;
  ratingCount: number;
  projectsCount: number;
  portfolio: DemoPortfolioItem[];
  services: DemoService[];
  products: { id: string; slug: string; name: string; tagline: string; priceCents: number; categoryName: string }[];
}

export interface DemoDemand {
  id: string;
  slug: string;
  title: string;
  problem: string;
  goal: string;
  details: string;
  category: string;
  tools: string[];
  budgetMinCents: number;
  budgetMaxCents: number;
  deadlineWeeks: number;
  status: 'OPEN' | 'IN_REVIEW';
  proposalCount: number;
  buyerName: string;
  buyerCompany: string | null;
  createdAt: Date;
}

const DAY = 86_400_000;
const now = () => Date.now();

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 'demo-prod-sales-agent',
    slug: 'ai-sales-agent',
    name: 'AI Sales Agent',
    tagline: 'Agente de IA para qualificação automática de leads.',
    descriptionMd:
      '## O que o AI Sales Agent resolve\n\nQualifica cada lead que chega no CRM e devolve um resumo com intenção de compra, orçamento e urgência — antes de um vendedor humano gastar tempo com quem não está pronto para comprar.\n\n## Como ele trabalha\n\nAs regras de qualificação são configuráveis por formulário. Cada conversa fica registrada, então dá para auditar exatamente por que um lead foi classificado como quente ou frio.\n\n## Para quem é\n\nTimes comerciais que já usam HubSpot, WhatsApp ou n8n e querem parar de perder tempo com lead não qualificado.',
    priceCents: 14_900,
    currency: 'BRL',
    categoryName: 'AI Agents',
    authorName: 'Lucas Martins',
    authorVerified: true,
    authorProductsCount: 4,
    ratingSum: 47,
    ratingCount: 10,
    salesCount: 312,
    tags: ['Vendas', 'CRM'],
    benefits: [
      'Responde no seu tom, com as regras de negócio que você define.',
      'Registra cada interação para auditoria e melhoria contínua.',
      'Roda em cima das ferramentas que sua equipe já usa.',
      'Painel de acompanhamento desde o primeiro dia em produção.',
    ],
    included: [
      'Fluxo completo pronto para importar',
      'Prompts e regras configuráveis',
      'Painel de acompanhamento',
      'Documentação de instalação',
      '90 dias de suporte do criador',
      'Atualizações por 12 meses',
    ],
    requirements: [
      'Conta ativa nas integrações listadas',
      'Acesso de administrador para conectar as APIs',
      'Base mínima de histórico para calibrar as respostas',
    ],
    compat: ['Web', 'API REST', 'Webhook', 'Exportação CSV'],
    integrations: ['HubSpot', 'WhatsApp', 'n8n'],
    videoUrl: 'https://www.youtube-nocookie.com/embed/demo-ai-sales-agent',
    images: [
      { id: 'img-1', alt: 'Tela principal do AI Sales Agent' },
      { id: 'img-2', alt: 'Painel de acompanhamento do AI Sales Agent' },
      { id: 'img-3', alt: 'Configuração das regras do AI Sales Agent' },
    ],
    reviews: [
      {
        id: 'rev-1',
        authorName: 'Renata Costa',
        authorHeadline: 'Head de Vendas, SaaS B2B',
        rating: 5,
        comment:
          'Reduziu em metade o tempo que o time gastava triando lead frio. Configurar levou uma tarde.',
      },
      {
        id: 'rev-2',
        authorName: 'Diego Farias',
        authorHeadline: 'Fundador',
        rating: 5,
        comment: 'Suporte do criador respondeu no mesmo dia quando travei na integração com HubSpot.',
      },
    ],
  },
  {
    id: 'demo-prod-whatsapp-support',
    slug: 'whatsapp-support-agent',
    name: 'WhatsApp Support Agent',
    tagline: 'Automatize o primeiro atendimento e o encaminhamento de clientes.',
    descriptionMd:
      '## O que o WhatsApp Support Agent resolve\n\nAssume o primeiro contato no WhatsApp, responde dúvida recorrente e encaminha para o time certo quando o caso exige humano.\n\n## Como ele trabalha\n\nRegras de encaminhamento por palavra-chave e horário, editáveis sem tocar em código. Cada conversa fica registrada.\n\n## Para quem é\n\nOperações de atendimento que recebem volume alto e repetitivo pelo WhatsApp.',
    priceCents: 19_900,
    currency: 'BRL',
    categoryName: 'Chatbots',
    authorName: 'Marina Duarte',
    authorVerified: true,
    authorProductsCount: 3,
    ratingSum: 43,
    ratingCount: 9,
    salesCount: 268,
    tags: ['Atendimento', 'WhatsApp'],
    benefits: [
      'Responde no seu tom, com as regras de negócio que você define.',
      'Registra cada interação para auditoria e melhoria contínua.',
      'Roda em cima das ferramentas que sua equipe já usa.',
      'Painel de acompanhamento desde o primeiro dia em produção.',
    ],
    included: [
      'Fluxo completo pronto para importar',
      'Prompts e regras configuráveis',
      'Painel de acompanhamento',
      'Documentação de instalação',
      '90 dias de suporte do criador',
      'Atualizações por 12 meses',
    ],
    requirements: [
      'Conta ativa nas integrações listadas',
      'Acesso de administrador para conectar as APIs',
      'Base mínima de histórico para calibrar as respostas',
    ],
    compat: ['Web', 'API REST', 'Webhook', 'Exportação CSV'],
    integrations: ['WhatsApp', 'Make'],
    videoUrl: null,
    images: [
      { id: 'img-1', alt: 'Tela principal do WhatsApp Support Agent' },
      { id: 'img-2', alt: 'Painel de acompanhamento do WhatsApp Support Agent' },
    ],
    reviews: [
      {
        id: 'rev-1',
        authorName: 'Paula Menezes',
        authorHeadline: 'Coordenadora de CS',
        rating: 4,
        comment: 'Ótimo para o primeiro filtro. Ajustamos os gatilhos na primeira semana e ficou redondo.',
      },
    ],
  },
  {
    id: 'demo-prod-lead-qualification',
    slug: 'lead-qualification-workflow',
    name: 'Lead Qualification Workflow',
    tagline: 'Qualifique e distribua leads automaticamente entre o time.',
    descriptionMd:
      '## O que o Lead Qualification Workflow resolve\n\nDistribui cada lead novo para o vendedor certo, com base em critério configurável — território, porte, produto de interesse.\n\n## Para quem é\n\nTimes comerciais com mais de três vendedores que ainda distribuem lead manualmente.',
    priceCents: 8_900,
    currency: 'BRL',
    categoryName: 'Workflows',
    authorName: 'Rafael Nogueira',
    authorVerified: false,
    authorProductsCount: 2,
    ratingSum: 22,
    ratingCount: 5,
    salesCount: 196,
    tags: ['n8n', 'Vendas'],
    benefits: [
      'Distribuição justa e auditável entre o time.',
      'Critério de roteamento 100% configurável.',
      'Roda em cima das ferramentas que sua equipe já usa.',
    ],
    included: [
      'Fluxo completo pronto para importar',
      'Documentação de instalação',
      '90 dias de suporte do criador',
    ],
    requirements: ['Conta ativa nas integrações listadas'],
    compat: ['Web', 'Webhook'],
    integrations: ['n8n', 'HubSpot'],
    videoUrl: null,
    images: [{ id: 'img-1', alt: 'Tela principal do Lead Qualification Workflow' }],
    reviews: [],
  },
  {
    id: 'demo-prod-content-engine',
    slug: 'ai-content-engine',
    name: 'AI Content Engine',
    tagline: 'Automatize pesquisa, produção e organização de conteúdo.',
    descriptionMd:
      '## O que o AI Content Engine resolve\n\nPesquisa o tema, produz o primeiro rascunho e organiza tudo no seu Notion — o time de conteúdo edita em vez de partir do zero.\n\n## Para quem é\n\nTimes de marketing que precisam manter um ritmo de publicação que a equipe atual não dá conta sozinha.',
    priceCents: 12_900,
    currency: 'BRL',
    categoryName: 'Automações',
    authorName: 'Ana Vasques',
    authorVerified: true,
    authorProductsCount: 5,
    ratingSum: 38,
    ratingCount: 8,
    salesCount: 421,
    tags: ['Marketing', 'Conteúdo'],
    benefits: [
      'Corta o tempo do rascunho em branco pela metade.',
      'Organização automática no Notion.',
      'Painel de acompanhamento de produção.',
    ],
    included: [
      'Fluxo completo pronto para importar',
      'Prompts configuráveis',
      '90 dias de suporte do criador',
    ],
    requirements: ['Conta ativa no Notion e na OpenAI'],
    compat: ['Web', 'API REST'],
    integrations: ['OpenAI', 'Notion'],
    videoUrl: 'https://www.youtube-nocookie.com/embed/demo-ai-content-engine',
    images: [
      { id: 'img-1', alt: 'Tela principal do AI Content Engine' },
      { id: 'img-2', alt: 'Painel de produção do AI Content Engine' },
    ],
    reviews: [
      {
        id: 'rev-1',
        authorName: 'Igor Salgado',
        authorHeadline: 'Gerente de Marketing',
        rating: 5,
        comment: 'Triplicamos o ritmo de publicação sem contratar.',
      },
      {
        id: 'rev-2',
        authorName: 'Camila Ortiz',
        authorHeadline: null,
        rating: 4,
        comment: 'Bom produto, mas o rascunho ainda precisa de revisão de tom.',
      },
    ],
  },
  {
    id: 'demo-prod-contract-review',
    slug: 'contract-review-agent',
    name: 'Contract Review Agent',
    tagline: 'Lê contratos, aponta risco e devolve o resumo por cláusula.',
    descriptionMd:
      '## O que o Contract Review Agent resolve\n\nLê o contrato inteiro, sinaliza cláusula de risco e devolve um resumo executivo antes de qualquer reunião jurídica.\n\n## Para quem não é\n\nNão substitui parecer jurídico em contrato de alto valor — é uma primeira triagem, não a decisão final.',
    priceCents: 24_900,
    currency: 'BRL',
    categoryName: 'AI Agents',
    authorName: 'Diego Salles',
    authorVerified: true,
    authorProductsCount: 2,
    ratingSum: 25,
    ratingCount: 5,
    salesCount: 134,
    tags: ['Jurídico', 'Dados'],
    benefits: [
      'Aponta cláusula de risco em minutos, não em horas.',
      'Resumo executivo por cláusula.',
      'Registra cada análise para auditoria.',
    ],
    included: ['Fluxo completo pronto para importar', 'Documentação de instalação', '90 dias de suporte do criador'],
    requirements: ['Acesso de administrador para conectar as APIs'],
    compat: ['Web', 'API REST'],
    integrations: ['OpenAI', 'APIs'],
    videoUrl: null,
    images: [{ id: 'img-1', alt: 'Tela principal do Contract Review Agent' }],
    reviews: [
      {
        id: 'rev-1',
        authorName: 'Fernanda Ribas',
        authorHeadline: 'Advogada, jurídico interno',
        rating: 5,
        comment: 'Uso como primeira triagem antes de qualquer contrato ir para análise humana.',
      },
    ],
  },
  {
    id: 'demo-prod-prompt-pack',
    slug: 'prompt-pack-comercial',
    name: 'Prompt Pack Comercial',
    tagline: '32 prompts testados para prospecção, follow-up e proposta.',
    descriptionMd:
      '## O que o Prompt Pack Comercial resolve\n\n32 prompts prontos, testados em operação real, para prospecção fria, follow-up e redação de proposta comercial.\n\n## Para quem é\n\nVendedores e times comerciais que já usam ChatGPT no dia a dia e querem parar de reescrever o mesmo prompt toda semana.',
    priceCents: 5_900,
    currency: 'BRL',
    categoryName: 'Prompts',
    authorName: 'Tomás Bianchi',
    authorVerified: false,
    authorProductsCount: 3,
    ratingSum: 33,
    ratingCount: 7,
    salesCount: 587,
    tags: ['Vendas', 'Prompts'],
    benefits: ['32 prompts organizados por etapa do funil.', 'Testados em operação comercial real.'],
    included: ['Documento com os 32 prompts', 'Guia de uso', 'Atualizações por 12 meses'],
    requirements: ['Conta ativa na OpenAI'],
    compat: ['Web'],
    integrations: ['OpenAI'],
    videoUrl: null,
    images: [{ id: 'img-1', alt: 'Prévia do Prompt Pack Comercial' }],
    reviews: [
      {
        id: 'rev-1',
        authorName: 'Bruno Alencar',
        authorHeadline: 'SDR',
        rating: 5,
        comment: 'Uso todo dia. Pagou o preço na primeira semana.',
      },
    ],
  },
  {
    id: 'demo-prod-ops-report',
    slug: 'ops-report-template',
    name: 'Ops Report Template',
    tagline: 'Relatório operacional que se preenche sozinho toda segunda.',
    descriptionMd:
      '## O que o Ops Report Template resolve\n\nPuxa os números da semana e monta o relatório operacional automaticamente, pronto às 8h de toda segunda.',
    priceCents: 7_900,
    currency: 'BRL',
    categoryName: 'Templates',
    authorName: 'Helena Prado',
    authorVerified: false,
    authorProductsCount: 1,
    ratingSum: 18,
    ratingCount: 4,
    salesCount: 203,
    tags: ['Dados', 'Produtividade'],
    benefits: ['Relatório pronto sem esforço manual.', 'Configurável por área.'],
    included: ['Template pronto', 'Documentação de instalação'],
    requirements: ['Conta ativa no Notion'],
    compat: ['Web'],
    integrations: ['Notion', 'n8n'],
    videoUrl: null,
    images: [{ id: 'img-1', alt: 'Prévia do Ops Report Template' }],
    reviews: [],
  },
  {
    id: 'demo-prod-inbox-triage',
    slug: 'inbox-triage-agent',
    name: 'Inbox Triage Agent',
    tagline: 'Classifica, resume e encaminha e-mail por prioridade real.',
    descriptionMd:
      '## O que o Inbox Triage Agent resolve\n\nLê a caixa de entrada, classifica por urgência real e resume o que importa — a inbox zero deixa de ser aspiracional.',
    priceCents: 11_900,
    currency: 'BRL',
    categoryName: 'AI Agents',
    authorName: 'Lucas Martins',
    authorVerified: true,
    authorProductsCount: 4,
    ratingSum: 40,
    ratingCount: 9,
    salesCount: 289,
    tags: ['Produtividade', 'Atendimento'],
    benefits: ['Classificação por urgência real, não só por palavra-chave.', 'Resumo direto na notificação.'],
    included: ['Fluxo completo pronto para importar', '90 dias de suporte do criador'],
    requirements: ['Conta ativa no Gmail'],
    compat: ['Web', 'API REST'],
    integrations: ['Gmail', 'OpenAI'],
    videoUrl: 'https://www.youtube-nocookie.com/embed/demo-inbox-triage-agent',
    images: [{ id: 'img-1', alt: 'Tela principal do Inbox Triage Agent' }],
    reviews: [
      {
        id: 'rev-1',
        authorName: 'Marcos Vieira',
        authorHeadline: 'Diretor de Operações',
        rating: 4,
        comment: 'Levou um tempo para calibrar o que é "urgente" pro meu contexto, mas hoje é essencial.',
      },
    ],
  },
  {
    id: 'demo-prod-meeting-notes',
    slug: 'meeting-notes-automation',
    name: 'Meeting Notes Automation',
    tagline: 'Transcreve a reunião e devolve decisões e tarefas atribuídas.',
    descriptionMd:
      '## O que o Meeting Notes Automation resolve\n\nGrava, transcreve e devolve as decisões e tarefas da reunião, já atribuídas a cada pessoa — direto no seu calendário.',
    priceCents: 0,
    currency: 'BRL',
    categoryName: 'Automações',
    authorName: 'Ana Vasques',
    authorVerified: true,
    authorProductsCount: 5,
    ratingSum: 45,
    ratingCount: 9,
    salesCount: 741,
    tags: ['Produtividade'],
    benefits: ['Ata pronta em minutos.', 'Tarefas já atribuídas por pessoa.'],
    included: ['Fluxo completo pronto para importar', 'Documentação de instalação'],
    requirements: ['Conta ativa no Google Calendar'],
    compat: ['Web'],
    integrations: ['Google Calendar', 'Notion'],
    videoUrl: null,
    images: [{ id: 'img-1', alt: 'Tela principal do Meeting Notes Automation' }],
    reviews: [
      {
        id: 'rev-1',
        authorName: 'Sofia Prado',
        authorHeadline: 'PM',
        rating: 5,
        comment: 'Gratuito e melhor que ferramenta paga que já usei.',
      },
    ],
  },
  {
    id: 'demo-prod-churn-prediction',
    slug: 'churn-prediction-workflow',
    name: 'Churn Prediction Workflow',
    tagline: 'Aponta quem vai cancelar nas próximas semanas e sugere a ação.',
    descriptionMd:
      '## O que o Churn Prediction Workflow resolve\n\nCruza uso do produto e histórico de suporte para apontar, com semanas de antecedência, quem está prestes a cancelar — e sugere a ação certa para cada caso.',
    priceCents: 18_900,
    currency: 'BRL',
    categoryName: 'Workflows',
    authorName: 'Tomás Bianchi',
    authorVerified: false,
    authorProductsCount: 3,
    ratingSum: 21,
    ratingCount: 5,
    salesCount: 87,
    tags: ['Dados', 'Vendas'],
    benefits: ['Alerta com semanas de antecedência.', 'Sugestão de ação por perfil de risco.'],
    included: ['Fluxo completo pronto para importar', 'Documentação de instalação'],
    requirements: ['Base mínima de histórico para calibrar o modelo'],
    compat: ['Web', 'API REST'],
    integrations: ['Python', 'n8n'],
    videoUrl: null,
    images: [{ id: 'img-1', alt: 'Painel do Churn Prediction Workflow' }],
    reviews: [],
  },
  {
    id: 'demo-prod-seo-copy',
    slug: 'seo-product-copy-batch',
    name: 'SEO Product Copy Batch',
    tagline: 'Título, descrição e atributos para o catálogo inteiro numa passada.',
    descriptionMd:
      '## O que o SEO Product Copy Batch resolve\n\nGera título, descrição e atributos otimizados para busca em lote — o catálogo inteiro numa passada, em vez de produto por produto.',
    priceCents: 6_900,
    currency: 'BRL',
    categoryName: 'Templates',
    authorName: 'Ana Vasques',
    authorVerified: true,
    authorProductsCount: 5,
    ratingSum: 27,
    ratingCount: 6,
    salesCount: 156,
    tags: ['Marketing', 'Conteúdo'],
    benefits: ['Catálogo inteiro em uma passada.', 'Copy otimizada para busca.'],
    included: ['Fluxo completo pronto para importar', 'Documentação de instalação'],
    requirements: ['Conta ativa no Shopify'],
    compat: ['Web', 'Exportação CSV'],
    integrations: ['Shopify', 'OpenAI'],
    videoUrl: null,
    images: [{ id: 'img-1', alt: 'Prévia do SEO Product Copy Batch' }],
    reviews: [],
  },
] as const satisfies DemoProduct[];

// ---------------------------------------------------------------------------
// Professionals
// ---------------------------------------------------------------------------

export const DEMO_PROFESSIONALS: DemoProfessional[] = [
  {
    id: 'demo-pro-lucas',
    slug: 'lucas-martins',
    name: 'Lucas Martins',
    title: 'AI Automation Specialist',
    field: 'Agentes de IA',
    bio: 'Constrói agentes que qualificam, respondem e registram — do primeiro contato ao CRM. Trabalha com n8n e API própria.',
    location: 'São Paulo, BR',
    skills: ['n8n', 'AI Agents', 'CRM', 'APIs'],
    rateMinCents: 300_000,
    rateMaxCents: 1_200_000,
    availability: 'NOW',
    verified: true,
    ratingSum: 155,
    ratingCount: 32,
    projectsCount: 32,
    portfolio: [
      { id: 'p1', title: 'Agente de qualificação para imobiliária', description: 'Qualificação automática de leads com roteamento por bairro de interesse.', meta: '3 semanas · R$ 8.400' },
      { id: 'p2', title: 'Roteador de atendimento multicanal', description: 'Unificou WhatsApp, e-mail e chat num único fluxo de triagem.', meta: '2 semanas · R$ 5.200' },
      { id: 'p3', title: 'Integração CRM + WhatsApp + ERP', description: 'Sincronização de pedido, cliente e conversa em tempo real.', meta: '5 semanas · R$ 11.900' },
    ],
    services: [
      { id: 's1', title: 'Agente de qualificação sob medida', description: 'Construído do zero para o seu funil comercial.', fromCents: 800_000, deliveryDays: 21 },
      { id: 's2', title: 'Integração CRM + WhatsApp', description: 'Conecta seu CRM ao WhatsApp Business com roteamento configurável.', fromCents: 450_000, deliveryDays: 14 },
    ],
    products: [
      { id: 'demo-prod-sales-agent', slug: 'ai-sales-agent', name: 'AI Sales Agent', tagline: 'Agente de IA para qualificação automática de leads.', priceCents: 14_900, categoryName: 'AI Agents' },
      { id: 'demo-prod-inbox-triage', slug: 'inbox-triage-agent', name: 'Inbox Triage Agent', tagline: 'Classifica, resume e encaminha e-mail por prioridade real.', priceCents: 11_900, categoryName: 'AI Agents' },
    ],
  },
  {
    id: 'demo-pro-marina',
    slug: 'marina-duarte',
    name: 'Marina Duarte',
    title: 'RevOps & Integrações',
    field: 'Vendas e CRM',
    bio: 'Nove anos em operações comerciais. Conecta CRM, WhatsApp e dados de venda em um fluxo único e auditável.',
    location: 'São Paulo, BR',
    skills: ['HubSpot', 'Make', 'WhatsApp', 'Dados'],
    rateMinCents: 500_000,
    rateMaxCents: 1_800_000,
    availability: 'SOON',
    verified: true,
    ratingSum: 221,
    ratingCount: 47,
    projectsCount: 47,
    portfolio: [
      { id: 'p1', title: 'Funil comercial automatizado ponta a ponta', description: 'Do primeiro contato ao fechamento, sem etapa manual.', meta: '6 semanas · R$ 16.500' },
      { id: 'p2', title: 'Migração e limpeza de base no HubSpot', description: 'Deduplicação e enriquecimento de mais de 40 mil contatos.', meta: '4 semanas · R$ 9.800' },
    ],
    services: [
      { id: 's1', title: 'Auditoria de funil comercial', description: 'Mapeia onde o funil perde lead e propõe automação.', fromCents: 350_000, deliveryDays: 10 },
    ],
    products: [
      { id: 'demo-prod-whatsapp-support', slug: 'whatsapp-support-agent', name: 'WhatsApp Support Agent', tagline: 'Automatize o primeiro atendimento e o encaminhamento de clientes.', priceCents: 19_900, categoryName: 'Chatbots' },
    ],
  },
  {
    id: 'demo-pro-diego',
    slug: 'diego-salles',
    name: 'Diego Salles',
    title: 'Implantação em Saúde',
    field: 'Operações',
    bio: 'Clínicas e consultórios: agenda, confirmação e prontuário conectados sem trocar o sistema que já existe.',
    location: 'Belo Horizonte, BR',
    skills: ['Google Calendar', 'WhatsApp', 'n8n', 'APIs'],
    rateMinCents: 250_000,
    rateMaxCents: 1_000_000,
    availability: 'NOW',
    verified: true,
    ratingSum: 179,
    ratingCount: 38,
    projectsCount: 38,
    portfolio: [
      { id: 'p1', title: 'Confirmação automática em rede de clínicas', description: 'Reduziu falta em 30% com lembrete e confirmação por WhatsApp.', meta: '3 semanas · R$ 8.900' },
    ],
    services: [
      { id: 's1', title: 'Automação de agenda para clínica', description: 'Confirmação, remarcação e fila de espera automatizadas.', fromCents: 400_000, deliveryDays: 15 },
    ],
    products: [
      { id: 'demo-prod-contract-review', slug: 'contract-review-agent', name: 'Contract Review Agent', tagline: 'Lê contratos, aponta risco e devolve o resumo por cláusula.', priceCents: 24_900, categoryName: 'AI Agents' },
    ],
  },
  {
    id: 'demo-pro-fernando',
    slug: 'fernando-aguiar',
    name: 'Fernando Aguiar',
    title: 'Dados e Business Intelligence',
    field: 'Dados',
    bio: 'Tira o número da planilha e coloca em painel que a diretoria confia. Modelagem, pipeline e governança.',
    location: 'São Paulo, BR',
    skills: ['Python', 'Google Sheets', 'Dados', 'APIs'],
    rateMinCents: 600_000,
    rateMaxCents: 2_200_000,
    availability: 'FULL',
    verified: true,
    ratingSum: 263,
    ratingCount: 56,
    projectsCount: 56,
    portfolio: [
      { id: 'p1', title: 'Data warehouse para varejo multicanal', description: 'Unificou venda online e física num painel único.', meta: '8 semanas · R$ 32.000' },
    ],
    services: [],
    products: [],
  },
  {
    id: 'demo-pro-larissa',
    slug: 'larissa-fontes',
    name: 'Larissa Fontes',
    title: 'Growth e Conteúdo com IA',
    field: 'Marketing',
    bio: 'Escala produção de conteúdo e campanha sem perder a voz da marca. Trabalha com times de 1 a 40 pessoas.',
    location: 'Rio de Janeiro, BR',
    skills: ['OpenAI', 'Conteúdo', 'HubSpot', 'Make'],
    rateMinCents: 250_000,
    rateMaxCents: 900_000,
    availability: 'NOW',
    verified: false,
    ratingSum: 166,
    ratingCount: 34,
    projectsCount: 34,
    portfolio: [
      { id: 'p1', title: 'Motor de conteúdo para blog e social', description: 'Triplicou o ritmo de publicação sem contratar.', meta: '4 semanas · R$ 9.900' },
    ],
    services: [
      { id: 's1', title: 'Motor de conteúdo sob medida', description: 'Pesquisa, rascunho e organização automatizados.', fromCents: 500_000, deliveryDays: 20 },
    ],
    products: [],
  },
  {
    id: 'demo-pro-gustavo',
    slug: 'gustavo-rocha',
    name: 'Gustavo Rocha',
    title: 'Integrações e APIs',
    field: 'Engenharia',
    bio: 'Conecta o que não foi feito para conversar. Webhooks, filas e retry — o encanamento que ninguém vê e todo mundo depende.',
    location: 'Porto Alegre, BR',
    skills: ['APIs', 'Python', 'n8n', 'Dados'],
    rateMinCents: 550_000,
    rateMaxCents: 2_000_000,
    availability: 'SOON',
    verified: true,
    ratingSum: 296,
    ratingCount: 61,
    projectsCount: 61,
    portfolio: [
      { id: 'p1', title: 'Integração ERP legado com e-commerce', description: 'Sincronização de estoque em tempo real entre dois sistemas que nunca se falaram.', meta: '7 semanas · R$ 27.500' },
    ],
    services: [],
    products: [],
  },
] as const satisfies DemoProfessional[];

// ---------------------------------------------------------------------------
// Demands
// ---------------------------------------------------------------------------

export const DEMO_DEMANDS: DemoDemand[] = [
  {
    id: 'demo-demand-1',
    slug: 'automatizar-conciliacao-financeira',
    title: 'Automatizar conciliação financeira mensal',
    problem: 'Fechamos o mês manualmente cruzando extrato bancário com o ERP. Leva 3 dias e sempre sobra divergência.',
    goal: 'Reduzir o fechamento para menos de um dia, com divergência sinalizada automaticamente.',
    details: 'Usamos Omie e o banco disponibiliza extrato via OFX. Precisa gerar um relatório de divergências ao final do processo.',
    category: 'Automações',
    tools: ['Omie', 'n8n'],
    budgetMinCents: 500_000,
    budgetMaxCents: 1_200_000,
    deadlineWeeks: 4,
    status: 'OPEN',
    proposalCount: 3,
    buyerName: 'Rodrigo Almeida',
    buyerCompany: 'Comércio Almeida Ltda',
    createdAt: new Date(now() - 2 * DAY),
  },
  {
    id: 'demo-demand-2',
    slug: 'chatbot-agendamento-clinica-odontologica',
    title: 'Chatbot de agendamento para clínica odontológica',
    problem: 'Recepção perde ligação por estar ocupada e o paciente desiste de agendar.',
    goal: 'Agendamento por WhatsApp funcionando 24h, integrado à nossa agenda atual.',
    details: 'Usamos Google Calendar para a agenda dos dentistas. Precisa lidar com remarcação e cancelamento também.',
    category: 'Chatbots',
    tools: ['WhatsApp', 'Google Calendar'],
    budgetMinCents: 300_000,
    budgetMaxCents: 800_000,
    deadlineWeeks: 3,
    status: 'OPEN',
    proposalCount: 5,
    buyerName: 'Dra. Beatriz Lemos',
    buyerCompany: 'Clínica Sorriso Pleno',
    createdAt: new Date(now() - 5 * DAY),
  },
  {
    id: 'demo-demand-3',
    slug: 'agente-triagem-suporte-tecnico',
    title: 'Agente de triagem para suporte técnico',
    problem: 'Todo chamado cai na mesma fila, sem prioridade. Ticket crítico demora tanto quanto dúvida simples.',
    goal: 'Classificar por urgência real e rotear automaticamente para o time certo.',
    details: 'Usamos Zendesk hoje. O ideal é que a triagem rode antes do chamado entrar na fila.',
    category: 'AI Agents',
    tools: ['Zendesk', 'OpenAI'],
    budgetMinCents: 400_000,
    budgetMaxCents: 1_000_000,
    deadlineWeeks: 5,
    status: 'IN_REVIEW',
    proposalCount: 7,
    buyerName: 'Carla Sousa',
    buyerCompany: 'Nuvem Tech',
    createdAt: new Date(now() - 9 * DAY),
  },
  {
    id: 'demo-demand-4',
    slug: 'relatorio-vendas-semanal-automatico',
    title: 'Relatório de vendas semanal automático',
    problem: 'Um analista monta o relatório de vendas manualmente toda sexta, puxando de três planilhas diferentes.',
    goal: 'Relatório pronto automaticamente, com gráfico e comparação com a semana anterior.',
    details: 'As três fontes são Google Sheets. O relatório final vai por e-mail para a diretoria.',
    category: 'Workflows',
    tools: ['Google Sheets', 'n8n'],
    budgetMinCents: 200_000,
    budgetMaxCents: 500_000,
    deadlineWeeks: 2,
    status: 'OPEN',
    proposalCount: 2,
    buyerName: 'Henrique Bastos',
    buyerCompany: null,
    createdAt: new Date(now() - 1 * DAY),
  },
] as const satisfies DemoDemand[];

export const DEMO_PROFESSIONAL_FIELDS = [
  { field: 'Agentes de IA', count: 1 },
  { field: 'Vendas e CRM', count: 1 },
  { field: 'Operações', count: 1 },
  { field: 'Dados', count: 1 },
  { field: 'Marketing', count: 1 },
  { field: 'Engenharia', count: 1 },
];

export function findDemoProduct(slug: string): DemoProduct | undefined {
  return DEMO_PRODUCTS.find((p) => p.slug === slug);
}

export function findDemoProfessional(slug: string): DemoProfessional | undefined {
  return DEMO_PROFESSIONALS.find((p) => p.slug === slug);
}

export function findDemoDemand(idOrSlug: string): DemoDemand | undefined {
  return DEMO_DEMANDS.find((d) => d.slug === idOrSlug || d.id === idOrSlug);
}

// ---------------------------------------------------------------------------
// In-memory filtering, mirroring the real query logic closely enough that
// playing with filters in demo mode still feels like the real catalogue.
// ---------------------------------------------------------------------------

const PRODUCT_PAGE_SIZE = 9;
const PRO_PAGE_SIZE = 6;

function average(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}

function priceMatches(product: DemoProduct, price: ProductFilters['price']): boolean {
  switch (price) {
    case 'free':
      return product.priceCents === 0;
    case 'u100':
      return product.priceCents > 0 && product.priceCents < 10_000;
    case '100-199':
      return product.priceCents >= 10_000 && product.priceCents < 20_000;
    case '200':
      return product.priceCents >= 20_000;
    default:
      return true;
  }
}

function productSort(sort: ProductFilters['sort']) {
  return (a: DemoProduct, b: DemoProduct) => {
    switch (sort) {
      case 'sold':
        return b.salesCount - a.salesCount;
      case 'rating':
        return average(b.ratingSum, b.ratingCount) - average(a.ratingSum, a.ratingCount);
      case 'price-l':
        return a.priceCents - b.priceCents;
      case 'price-h':
        return b.priceCents - a.priceCents;
      case 'new':
      case 'rel':
      default:
        return b.salesCount - a.salesCount;
    }
  };
}

export interface DemoProductListResult {
  items: DemoProduct[];
  total: number;
  page: number;
  pageCount: number;
}

/** Same shape and semantics as `listProducts`, over the static catalogue. */
export function filterDemoProducts(filters: ProductFilters): DemoProductListResult {
  let items = DEMO_PRODUCTS.filter((product) => priceMatches(product, filters.price));

  if (filters.category && filters.category !== 'Todos') {
    items = items.filter(
      (p) => p.categoryName === filters.category || p.tags.includes(filters.category!)
    );
  }

  if (filters.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q)
    );
  }

  if (filters.seller === 'verified') {
    items = items.filter((p) => p.authorVerified);
  }

  if (filters.rating !== 'all') {
    const min = Number(filters.rating);
    items = items.filter((p) => p.ratingCount > 0 && average(p.ratingSum, p.ratingCount) >= min);
  }

  items = [...items].sort(productSort(filters.sort));

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const start = (page - 1) * PRODUCT_PAGE_SIZE;

  return {
    items: items.slice(start, start + PRODUCT_PAGE_SIZE),
    total,
    page,
    pageCount,
  };
}

export function demoProductFilterCounts() {
  return {
    total: DEMO_PRODUCTS.length,
    free: DEMO_PRODUCTS.filter((p) => p.priceCents === 0).length,
    verified: DEMO_PRODUCTS.filter((p) => p.authorVerified).length,
  };
}

function tierMatches(pro: DemoProfessional, tier: ProfessionalFilters['tier']): boolean {
  switch (tier) {
    case 'low':
      return pro.rateMaxCents <= 900_000;
    case 'mid':
      return pro.rateMinCents >= 200_000 && pro.rateMaxCents <= 1_200_000;
    case 'high':
      return pro.rateMinCents >= 500_000;
    default:
      return true;
  }
}

function professionalSort(sort: ProfessionalFilters['sort']) {
  return (a: DemoProfessional, b: DemoProfessional) => {
    switch (sort) {
      case 'rating':
        return average(b.ratingSum, b.ratingCount) - average(a.ratingSum, a.ratingCount);
      case 'projects':
        return b.projectsCount - a.projectsCount;
      case 'avail':
        return (a.availability === 'NOW' ? 0 : 1) - (b.availability === 'NOW' ? 0 : 1);
      case 'rel':
      default:
        return b.projectsCount - a.projectsCount;
    }
  };
}

export interface DemoProfessionalListResult {
  items: DemoProfessional[];
  total: number;
  page: number;
  pageCount: number;
}

/** Same shape and semantics as `listProfessionals`, over the static roster. */
export function filterDemoProfessionals(
  filters: ProfessionalFilters
): DemoProfessionalListResult {
  let items = DEMO_PROFESSIONALS.filter((pro) => tierMatches(pro, filters.tier));

  if (filters.field && filters.field !== 'Todas as áreas') {
    items = items.filter((p) => p.field === filters.field);
  }

  if (filters.skill && filters.skill !== 'Todas') {
    items = items.filter((p) => p.skills.includes(filters.skill!));
  }

  if (filters.avail !== 'all') {
    items = items.filter((p) => p.availability === filters.avail.toUpperCase());
  }

  if (filters.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.skills.some((skill) => skill.toLowerCase().includes(q))
    );
  }

  if (filters.rating !== 'all') {
    const min = Number(filters.rating);
    items = items.filter((p) => p.ratingCount > 0 && average(p.ratingSum, p.ratingCount) >= min);
  }

  items = [...items].sort(professionalSort(filters.sort));

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / PRO_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const start = (page - 1) * PRO_PAGE_SIZE;

  return {
    items: items.slice(start, start + PRO_PAGE_SIZE),
    total,
    page,
    pageCount,
  };
}

const DEMAND_PAGE_SIZE = 10;

export interface DemoDemandListResult {
  items: DemoDemand[];
  total: number;
  page: number;
  pageCount: number;
}

/** Same shape and semantics as `listOpenDemands`, over the static list. */
export function filterDemoDemands(page: number, category?: string): DemoDemandListResult {
  const items = category && category !== 'Todas'
    ? DEMO_DEMANDS.filter((d) => d.category === category)
    : DEMO_DEMANDS;

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / DEMAND_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * DEMAND_PAGE_SIZE;

  return {
    items: items.slice(start, start + DEMAND_PAGE_SIZE),
    total,
    page: safePage,
    pageCount,
  };
}
