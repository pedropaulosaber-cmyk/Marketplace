/**
 * Development seed.
 *
 * Populates a realistic marketplace: categories, creators, professionals,
 * published products, demands, proposals, paid orders and reviews — enough
 * that every page has meaningful content and every flow can be exercised.
 *
 * Idempotent: safe to run repeatedly. Never run against production.
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const db = new PrismaClient();

const ARGON_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Shared password for every seeded account, in development only. */
const DEV_PASSWORD = 'automatize2026';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CATEGORIES = [
  'AI Agents',
  'Automações',
  'Workflows',
  'Prompts',
  'Templates',
  'Chatbots',
] as const;

const CREATORS = [
  { name: 'Lucas Martins', email: 'lucas@automatize.dev' },
  { name: 'Marina Duarte', email: 'marina@automatize.dev' },
  { name: 'Rafael Nogueira', email: 'rafael@automatize.dev' },
  { name: 'Ana Vasques', email: 'ana@automatize.dev' },
  { name: 'Camila Reis', email: 'camila@automatize.dev' },
  { name: 'Diego Salles', email: 'diego@automatize.dev' },
  { name: 'Tomás Bianchi', email: 'tomas@automatize.dev' },
  { name: 'Helena Prado', email: 'helena@automatize.dev' },
  { name: 'Bruno Tavares', email: 'bruno@automatize.dev' },
  { name: 'Juliana Kim', email: 'juliana@automatize.dev' },
  { name: 'Ricardo Mendes', email: 'ricardo@automatize.dev' },
  { name: 'Patrícia Lobo', email: 'patricia@automatize.dev' },
  { name: 'Fernando Aguiar', email: 'fernando@automatize.dev' },
  { name: 'Larissa Fontes', email: 'larissa@automatize.dev' },
  { name: 'Gustavo Rocha', email: 'gustavo@automatize.dev' },
  { name: 'Beatriz Nunes', email: 'beatriz@automatize.dev' },
] as const;

const PRODUCTS = [
  {
    name: 'AI Sales Agent',
    category: 'AI Agents',
    tagline: 'Agente de IA para qualificação automática de leads.',
    priceCents: 14_900,
    author: 'lucas@automatize.dev',
    tags: ['Vendas', 'CRM'],
    integrations: ['HubSpot', 'WhatsApp', 'n8n'],
  },
  {
    name: 'WhatsApp Support Agent',
    category: 'Chatbots',
    tagline: 'Automatize o primeiro atendimento e o encaminhamento de clientes.',
    priceCents: 19_900,
    author: 'marina@automatize.dev',
    tags: ['Atendimento', 'WhatsApp'],
    integrations: ['WhatsApp', 'Make'],
  },
  {
    name: 'Lead Qualification Workflow',
    category: 'Workflows',
    tagline: 'Qualifique e distribua leads automaticamente entre o time.',
    priceCents: 8_900,
    author: 'rafael@automatize.dev',
    tags: ['n8n', 'Vendas'],
    integrations: ['n8n', 'HubSpot'],
  },
  {
    name: 'AI Content Engine',
    category: 'Automações',
    tagline: 'Automatize pesquisa, produção e organização de conteúdo.',
    priceCents: 12_900,
    author: 'ana@automatize.dev',
    tags: ['Marketing', 'Conteúdo'],
    integrations: ['OpenAI', 'Notion'],
  },
  {
    name: 'CRM Automation Kit',
    category: 'Automações',
    tagline: 'Workflows prontos para automatizar tarefas comerciais.',
    priceCents: 9_900,
    author: 'camila@automatize.dev',
    tags: ['CRM', 'Make'],
    integrations: ['Make', 'HubSpot'],
  },
  {
    name: 'Contract Review Agent',
    category: 'AI Agents',
    tagline: 'Lê contratos, aponta risco e devolve o resumo por cláusula.',
    priceCents: 24_900,
    author: 'diego@automatize.dev',
    tags: ['Jurídico', 'Dados'],
    integrations: ['OpenAI', 'APIs'],
  },
  {
    name: 'Prompt Pack Comercial',
    category: 'Prompts',
    tagline: '32 prompts testados para prospecção, follow-up e proposta.',
    priceCents: 5_900,
    author: 'tomas@automatize.dev',
    tags: ['Vendas', 'Prompts'],
    integrations: ['OpenAI'],
  },
  {
    name: 'Ops Report Template',
    category: 'Templates',
    tagline: 'Relatório operacional que se preenche sozinho toda segunda.',
    priceCents: 7_900,
    author: 'helena@automatize.dev',
    tags: ['Dados', 'Produtividade'],
    integrations: ['Notion', 'n8n'],
  },
  {
    name: 'Inbox Triage Agent',
    category: 'AI Agents',
    tagline: 'Classifica, resume e encaminha e-mail por prioridade real.',
    priceCents: 11_900,
    author: 'lucas@automatize.dev',
    tags: ['Produtividade', 'Atendimento'],
    integrations: ['Gmail', 'OpenAI'],
  },
  {
    name: 'Meeting Notes Automation',
    category: 'Automações',
    tagline: 'Transcreve a reunião e devolve decisões e tarefas atribuídas.',
    priceCents: 0,
    author: 'ana@automatize.dev',
    tags: ['Produtividade'],
    integrations: ['Google Calendar', 'Notion'],
  },
  {
    name: 'Churn Prediction Workflow',
    category: 'Workflows',
    tagline: 'Aponta quem vai cancelar nas próximas semanas e sugere a ação.',
    priceCents: 18_900,
    author: 'tomas@automatize.dev',
    tags: ['Dados', 'Vendas'],
    integrations: ['Python', 'n8n'],
  },
  {
    name: 'SEO Product Copy Batch',
    category: 'Templates',
    tagline: 'Título, descrição e atributos para o catálogo inteiro numa passada.',
    priceCents: 6_900,
    author: 'ana@automatize.dev',
    tags: ['Marketing', 'Conteúdo'],
    integrations: ['Shopify', 'OpenAI'],
  },
  {
    name: 'Agente de Cobrança Amigável',
    category: 'AI Agents',
    tagline: 'Recupera inadimplência por WhatsApp sem queimar o relacionamento.',
    priceCents: 21_900,
    author: 'bruno@automatize.dev',
    tags: ['Financeiro', 'WhatsApp'],
    integrations: ['WhatsApp', 'Omie', 'n8n'],
  },
  {
    name: 'Onboarding de Clientes Automático',
    category: 'Workflows',
    tagline: 'Do contrato assinado ao acesso liberado sem ninguém tocar.',
    priceCents: 13_900,
    author: 'juliana@automatize.dev',
    tags: ['Customer Success', 'Produtividade'],
    integrations: ['Slack', 'Notion', 'Make'],
  },
  {
    name: 'Chatbot de Agendamento Médico',
    category: 'Chatbots',
    tagline: 'Marca, confirma e remarca consultas direto na agenda da clínica.',
    priceCents: 27_900,
    author: 'patricia@automatize.dev',
    tags: ['Saúde', 'Atendimento'],
    integrations: ['WhatsApp', 'Google Calendar'],
  },
  {
    name: 'Analisador de Currículos',
    category: 'AI Agents',
    tagline: 'Lê 400 currículos e devolve os 10 que importam, com justificativa.',
    priceCents: 16_900,
    author: 'ricardo@automatize.dev',
    tags: ['RH', 'Dados'],
    integrations: ['OpenAI', 'Google Drive'],
  },
  {
    name: 'Prompt Pack Jurídico',
    category: 'Prompts',
    tagline: '48 prompts revisados por advogados para peças, resumos e pareceres.',
    priceCents: 8_900,
    author: 'diego@automatize.dev',
    tags: ['Jurídico', 'Prompts'],
    integrations: ['OpenAI'],
  },
  {
    name: 'Dashboard Financeiro Auto-Preenchido',
    category: 'Templates',
    tagline: 'DRE, fluxo de caixa e projeção atualizados sozinhos toda manhã.',
    priceCents: 11_900,
    author: 'fernando@automatize.dev',
    tags: ['Financeiro', 'Dados'],
    integrations: ['Google Sheets', 'Omie', 'n8n'],
  },
  {
    name: 'Gerador de Propostas Comerciais',
    category: 'Automações',
    tagline: 'Da reunião gravada à proposta pronta para assinatura em 4 minutos.',
    priceCents: 15_900,
    author: 'larissa@automatize.dev',
    tags: ['Vendas', 'Conteúdo'],
    integrations: ['OpenAI', 'DocuSign', 'HubSpot'],
  },
  {
    name: 'Monitor de Concorrência',
    category: 'Workflows',
    tagline: 'Avisa quando o concorrente muda preço, página ou anúncio.',
    priceCents: 9_900,
    author: 'gustavo@automatize.dev',
    tags: ['Marketing', 'Dados'],
    integrations: ['APIs', 'Slack', 'Python'],
  },
  {
    name: 'Atendente de E-commerce 24h',
    category: 'Chatbots',
    tagline: 'Responde rastreio, troca e dúvida de produto sem fila de espera.',
    priceCents: 22_900,
    author: 'beatriz@automatize.dev',
    tags: ['E-commerce', 'Atendimento'],
    integrations: ['Shopify', 'WhatsApp', 'OpenAI'],
  },
  {
    name: 'Classificador de Tickets de Suporte',
    category: 'AI Agents',
    tagline: 'Etiqueta, prioriza e roteia chamados pelo conteúdo real do texto.',
    priceCents: 14_900,
    author: 'juliana@automatize.dev',
    tags: ['Atendimento', 'Produtividade'],
    integrations: ['Zendesk', 'OpenAI'],
  },
  {
    name: 'Pipeline de Nota Fiscal',
    category: 'Automações',
    tagline: 'Captura, valida e arquiva NF-e sem digitação manual.',
    priceCents: 17_900,
    author: 'fernando@automatize.dev',
    tags: ['Financeiro', 'Fiscal'],
    integrations: ['Omie', 'Google Drive', 'n8n'],
  },
  {
    name: 'Kit de Prompts para Marketing',
    category: 'Prompts',
    tagline: '60 prompts de campanha, anúncio e e-mail com exemplos reais.',
    priceCents: 0,
    author: 'larissa@automatize.dev',
    tags: ['Marketing', 'Prompts'],
    integrations: ['OpenAI'],
  },
  {
    name: 'Template de Base de Conhecimento',
    category: 'Templates',
    tagline: 'Estrutura de documentação que a IA da empresa consegue ler.',
    priceCents: 6_900,
    author: 'patricia@automatize.dev',
    tags: ['Produtividade', 'Conteúdo'],
    integrations: ['Notion', 'OpenAI'],
  },
  {
    name: 'Agente de Pesquisa de Mercado',
    category: 'AI Agents',
    tagline: 'Levanta players, preço e posicionamento e entrega o relatório.',
    priceCents: 19_900,
    author: 'gustavo@automatize.dev',
    tags: ['Marketing', 'Dados'],
    integrations: ['OpenAI', 'APIs', 'Notion'],
  },
  {
    name: 'Recuperação de Carrinho Abandonado',
    category: 'Workflows',
    tagline: 'Sequência multicanal que traz de volta quem quase comprou.',
    priceCents: 12_900,
    author: 'beatriz@automatize.dev',
    tags: ['E-commerce', 'Vendas'],
    integrations: ['Shopify', 'WhatsApp', 'Make'],
  },
  {
    name: 'Resumo Diário de Notícias do Setor',
    category: 'Automações',
    tagline: 'Um e-mail às 7h com o que realmente mudou no seu mercado.',
    priceCents: 0,
    author: 'ricardo@automatize.dev',
    tags: ['Conteúdo', 'Produtividade'],
    integrations: ['APIs', 'Gmail', 'OpenAI'],
  },
  {
    name: 'Bot de Triagem de Leads no Instagram',
    category: 'Chatbots',
    tagline: 'Responde o direct, qualifica e joga o lead quente no CRM.',
    priceCents: 18_900,
    author: 'bruno@automatize.dev',
    tags: ['Vendas', 'Social'],
    integrations: ['Instagram', 'HubSpot', 'Make'],
  },
  {
    name: 'Auditor de Qualidade de Dados',
    category: 'Workflows',
    tagline: 'Encontra duplicata, campo vazio e valor impossível antes do relatório.',
    priceCents: 15_900,
    author: 'tomas@automatize.dev',
    tags: ['Dados', 'Produtividade'],
    integrations: ['Python', 'Google Sheets', 'n8n'],
  },
] as const;

const PROFESSIONALS = [
  {
    email: 'lucas@automatize.dev',
    title: 'AI Automation Specialist',
    field: 'Agentes de IA',
    bio: 'Constrói agentes que qualificam, respondem e registram — do primeiro contato ao CRM. Trabalha com n8n e API própria.',
    skills: ['n8n', 'AI Agents', 'CRM', 'APIs'],
    rateMinCents: 300_000,
    rateMaxCents: 1_200_000,
    location: 'São Paulo, BR',
    availability: 'NOW' as const,
    verified: true,
    projects: 32,
    works: [
      ['Agente de qualificação para imobiliária', '3 semanas · R$ 8.400'],
      ['Roteador de atendimento multicanal', '2 semanas · R$ 5.200'],
      ['Integração CRM + WhatsApp + ERP', '5 semanas · R$ 11.900'],
    ],
  },
  {
    email: 'marina@automatize.dev',
    title: 'RevOps & Integrações',
    field: 'Vendas e CRM',
    bio: 'Nove anos em operações comerciais. Conecta CRM, WhatsApp e dados de venda em um fluxo único e auditável.',
    skills: ['HubSpot', 'Make', 'WhatsApp', 'Dados'],
    rateMinCents: 500_000,
    rateMaxCents: 1_800_000,
    location: 'São Paulo, BR',
    availability: 'SOON' as const,
    verified: true,
    projects: 47,
    works: [
      ['Funil comercial automatizado ponta a ponta', '6 semanas · R$ 16.500'],
      ['Migração e limpeza de base no HubSpot', '4 semanas · R$ 9.800'],
      ['Painel de receita em tempo real', '3 semanas · R$ 7.200'],
    ],
  },
  {
    email: 'camila@automatize.dev',
    title: 'LLM Engineer',
    field: 'Dados e documentos',
    bio: 'Modelos aplicados a documentos jurídicos e financeiros, com trilha de auditoria em cada decisão automatizada.',
    skills: ['OpenAI', 'Python', 'APIs', 'Compliance'],
    rateMinCents: 800_000,
    rateMaxCents: 3_000_000,
    location: 'Lisboa, PT',
    availability: 'NOW' as const,
    verified: true,
    projects: 31,
    works: [
      ['Analisador de contratos para escritório', '7 semanas · R$ 27.000'],
      ['Triagem automática de processos', '4 semanas · R$ 14.000'],
      ['Extração estruturada de notas fiscais', '3 semanas · R$ 9.500'],
    ],
  },
  {
    email: 'rafael@automatize.dev',
    title: 'Conversational Design',
    field: 'Atendimento',
    bio: 'Atendimento em WhatsApp que resolve sem transbordar para humano. Integra estoque, pedido e pós-venda.',
    skills: ['WhatsApp', 'Make', 'Shopify', 'Chatbots'],
    rateMinCents: 200_000,
    rateMaxCents: 900_000,
    location: 'Porto Alegre, BR',
    availability: 'NOW' as const,
    verified: true,
    projects: 62,
    works: [
      ['Atendente de vendas 24h para e-commerce', '2 semanas · R$ 6.400'],
      ['Robô de pedidos para rede de restaurantes', '3 semanas · R$ 7.900'],
      ['Recuperação de carrinho por WhatsApp', '1 semana · R$ 2.800'],
    ],
  },
  {
    email: 'ana@automatize.dev',
    title: 'Content Automation',
    field: 'Marketing',
    bio: 'Conteúdo em escala para e-commerce e agências: catálogo, SEO e campanhas geradas dentro da marca do cliente.',
    skills: ['OpenAI', 'Shopify', 'Make', 'SEO'],
    rateMinCents: 150_000,
    rateMaxCents: 700_000,
    location: 'Recife, BR',
    availability: 'FULL' as const,
    verified: false,
    projects: 54,
    works: [
      ['Geração de 12 mil descrições de produto', '4 semanas · R$ 6.800'],
      ['Motor de campanha para agência', '3 semanas · R$ 5.100'],
      ['Calendário editorial automatizado', '2 semanas · R$ 3.200'],
    ],
  },
  {
    email: 'diego@automatize.dev',
    title: 'Implantação em Saúde',
    field: 'Operações',
    bio: 'Clínicas e consultórios: agenda, confirmação e prontuário conectados sem trocar o sistema que já existe.',
    skills: ['Google Calendar', 'WhatsApp', 'n8n', 'APIs'],
    rateMinCents: 250_000,
    rateMaxCents: 1_000_000,
    location: 'Belo Horizonte, BR',
    availability: 'NOW' as const,
    verified: true,
    projects: 38,
    works: [
      ['Confirmação automática em rede de clínicas', '3 semanas · R$ 8.900'],
      ['Resumo de anamnese por voz', '4 semanas · R$ 9.600'],
      ['Fila de espera inteligente', '2 semanas · R$ 4.100'],
    ],
  },
  {
    email: 'bruno@automatize.dev',
    title: 'Automação Financeira',
    field: 'Financeiro',
    bio: 'Contas a receber, cobrança e conciliação em fluxo único. Reduziu inadimplência em operações de 200 a 20 mil clientes.',
    skills: ['Omie', 'n8n', 'WhatsApp', 'Dados'],
    rateMinCents: 400_000,
    rateMaxCents: 1_500_000,
    location: 'Curitiba, BR',
    availability: 'NOW' as const,
    verified: true,
    projects: 29,
    works: [
      ['Régua de cobrança multicanal', '4 semanas · R$ 12.300'],
      ['Conciliação bancária automática', '3 semanas · R$ 8.700'],
      ['Painel de inadimplência por carteira', '2 semanas · R$ 5.400'],
    ],
  },
  {
    email: 'juliana@automatize.dev',
    title: 'Customer Success Ops',
    field: 'Operações',
    bio: 'Desenha onboarding e retenção que rodam sozinhos. Especialista em transformar processo de planilha em fluxo auditável.',
    skills: ['Notion', 'Make', 'Slack', 'Zendesk'],
    rateMinCents: 300_000,
    rateMaxCents: 1_100_000,
    location: 'Florianópolis, BR',
    availability: 'SOON' as const,
    verified: true,
    projects: 41,
    works: [
      ['Onboarding automatizado para SaaS B2B', '5 semanas · R$ 14.200'],
      ['Health score de carteira', '3 semanas · R$ 7.800'],
      ['Central de conhecimento com IA', '4 semanas · R$ 10.500'],
    ],
  },
  {
    email: 'patricia@automatize.dev',
    title: 'Chatbots e Atendimento',
    field: 'Atendimento',
    bio: 'Constrói assistentes que resolvem de verdade em vez de empurrar para o humano. Foco em saúde e serviços.',
    skills: ['WhatsApp', 'Chatbots', 'OpenAI', 'Google Calendar'],
    rateMinCents: 280_000,
    rateMaxCents: 950_000,
    location: 'Recife, BR',
    availability: 'NOW' as const,
    verified: false,
    projects: 23,
    works: [
      ['Assistente de agendamento para clínica', '3 semanas · R$ 7.400'],
      ['Triagem de convênio por WhatsApp', '2 semanas · R$ 4.900'],
      ['Pesquisa de satisfação automatizada', '1 semana · R$ 2.600'],
    ],
  },
  {
    email: 'fernando@automatize.dev',
    title: 'Dados e Business Intelligence',
    field: 'Dados',
    bio: 'Tira o número da planilha e coloca em painel que a diretoria confia. Modelagem, pipeline e governança.',
    skills: ['Python', 'Google Sheets', 'Dados', 'APIs'],
    rateMinCents: 600_000,
    rateMaxCents: 2_200_000,
    location: 'São Paulo, BR',
    availability: 'FULL' as const,
    verified: true,
    projects: 56,
    works: [
      ['Data warehouse para varejo multicanal', '8 semanas · R$ 32.000'],
      ['DRE automatizado com projeção', '4 semanas · R$ 13.500'],
      ['Auditoria de qualidade de base', '2 semanas · R$ 6.200'],
    ],
  },
  {
    email: 'larissa@automatize.dev',
    title: 'Growth e Conteúdo com IA',
    field: 'Marketing',
    bio: 'Escala produção de conteúdo e campanha sem perder a voz da marca. Trabalha com times de 1 a 40 pessoas.',
    skills: ['OpenAI', 'Conteúdo', 'HubSpot', 'Make'],
    rateMinCents: 250_000,
    rateMaxCents: 900_000,
    location: 'Rio de Janeiro, BR',
    availability: 'NOW' as const,
    verified: false,
    projects: 34,
    works: [
      ['Motor de conteúdo para blog e social', '4 semanas · R$ 9.900'],
      ['Gerador de proposta comercial', '3 semanas · R$ 7.100'],
      ['Campanha de reativação por e-mail', '2 semanas · R$ 4.800'],
    ],
  },
  {
    email: 'gustavo@automatize.dev',
    title: 'Integrações e APIs',
    field: 'Engenharia',
    bio: 'Conecta o que não foi feito para conversar. Webhooks, filas e retry — o encanamento que ninguém vê e todo mundo depende.',
    skills: ['APIs', 'Python', 'n8n', 'Dados'],
    rateMinCents: 550_000,
    rateMaxCents: 2_000_000,
    location: 'Porto Alegre, BR',
    availability: 'SOON' as const,
    verified: true,
    projects: 61,
    works: [
      ['Integração ERP legado com e-commerce', '7 semanas · R$ 27.500'],
      ['Monitor de concorrência com scraping', '3 semanas · R$ 8.300'],
      ['Camada de eventos para microserviços', '6 semanas · R$ 21.000'],
    ],
  },
] as const;

const DEMANDS = [
  {
    title: 'Automação de atendimento + CRM + WhatsApp',
    category: 'Atendimento',
    problem:
      'Preciso automatizar o atendimento da minha imobiliária pelo WhatsApp, integrar com meu CRM e classificar os leads automaticamente.',
    goal: 'Reduzir o tempo de primeira resposta de 4 horas para menos de 2 minutos e parar de perder lead fora do horário comercial.',
    details:
      'Hoje três corretores revezam o WhatsApp da imobiliária no celular pessoal. Nada fica registrado, e o lead que chega às 22h só é respondido no dia seguinte. Queremos um agente que responda, pergunte orçamento, bairro e tipo de imóvel, e grave tudo no HubSpot com uma nota de qualificação.',
    tools: ['WhatsApp', 'n8n', 'HubSpot'],
    budgetMinCents: 600_000,
    budgetMaxCents: 1_200_000,
    deadlineWeeks: 6,
  },
  {
    title: 'Conciliação bancária automática para escritório contábil',
    category: 'Financeiro',
    problem:
      'Conciliar extrato bancário e lançamentos de 40 clientes sem trabalho manual no fechamento do mês.',
    goal: 'Cortar de 6 dias para 1 o tempo de fechamento mensal da equipe.',
    details:
      'Trabalhamos com quatro bancos diferentes e cada cliente tem um plano de contas próprio. Precisamos de um fluxo que case automaticamente o que der, isole o que não bateu e explique o motivo em linguagem que o analista entenda.',
    tools: ['n8n', 'APIs', 'Dados'],
    budgetMinCents: 1_000_000,
    budgetMaxCents: 2_000_000,
    deadlineWeeks: 8,
  },
  {
    title: 'Agente de triagem de currículos por vaga',
    category: 'RH',
    problem:
      'Ler currículos contra os requisitos da vaga e devolver uma lista ordenada com justificativa.',
    goal: 'Diminuir de 3 dias para 3 horas o tempo entre a inscrição e o retorno ao candidato.',
    details:
      'Recebemos cerca de 900 currículos por mês em 12 vagas simultâneas. Queremos ranking com justificativa em texto, sem descartar ninguém automaticamente — a decisão continua sendo humana, mas com a leitura já feita.',
    tools: ['OpenAI', 'Notion'],
    budgetMinCents: 400_000,
    budgetMaxCents: 800_000,
    deadlineWeeks: 4,
  },
] as const;

const REVIEW_TEXTS = [
  'Subiu em três dias. O que mais pesou foi a documentação estar realmente completa.',
  'O suporte respondeu no mesmo dia nas duas vezes em que precisei. Vale o preço.',
  'Muito bom, mas exigiu mais ajuste de regra do que eu esperava no começo.',
  'Resolveu um problema que consumia horas da equipe toda semana.',
  'Instalação simples e o painel de acompanhamento ajuda demais.',
] as const;

async function main() {
  console.log('Seeding AUTOMATIZE…');

  const passwordHash = await hash(DEV_PASSWORD, ARGON_OPTIONS);

  // --- Categories ---------------------------------------------------------
  const categories = new Map<string, string>();
  for (const [index, name] of CATEGORIES.entries()) {
    const category = await db.category.upsert({
      where: { slug: slugify(name) },
      create: { slug: slugify(name), name, position: index },
      update: { position: index },
      select: { id: true },
    });
    categories.set(name, category.id);
  }
  console.log(`  categories: ${categories.size}`);

  // --- Admin --------------------------------------------------------------
  const admin = await db.user.upsert({
    where: { email: 'admin@automatize.dev' },
    create: {
      email: 'admin@automatize.dev',
      name: 'Equipe Automatize',
      passwordHash,
      emailVerifiedAt: new Date(),
      profile: { create: { headline: 'Administração da plataforma' } },
      roles: { create: [{ role: 'ADMIN' }, { role: 'BUYER' }] },
    },
    update: {},
    select: { id: true },
  });

  // --- Buyers -------------------------------------------------------------
  const buyers: string[] = [];
  for (const [index, name] of [
    'Imobiliária Vale Norte',
    'Contabilidade Prisma',
    'Grupo Meridiano',
    'Rede Fogo Alto',
  ].entries()) {
    const buyer = await db.user.upsert({
      where: { email: `comprador${index + 1}@automatize.dev` },
      create: {
        email: `comprador${index + 1}@automatize.dev`,
        name,
        passwordHash,
        emailVerifiedAt: new Date(),
        profile: { create: { company: name, location: 'Brasil' } },
        roles: { create: { role: 'BUYER' } },
      },
      update: {},
      select: { id: true },
    });
    buyers.push(buyer.id);
  }
  console.log(`  buyers: ${buyers.length}`);

  // --- Creators -----------------------------------------------------------
  const creators = new Map<string, string>();
  for (const creator of CREATORS) {
    const user = await db.user.upsert({
      where: { email: creator.email },
      create: {
        email: creator.email,
        name: creator.name,
        passwordHash,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            headline: 'Especialista em automação e IA',
            location: 'Brasil',
          },
        },
        roles: { create: [{ role: 'CREATOR' }, { role: 'BUYER' }] },
      },
      update: {},
      select: { id: true },
    });
    creators.set(creator.email, user.id);
  }
  console.log(`  creators: ${creators.size}`);

  // --- Professional profiles ----------------------------------------------
  for (const pro of PROFESSIONALS) {
    const userId = creators.get(pro.email);
    if (!userId) continue;

    await db.userRole.upsert({
      where: { userId_role: { userId, role: 'PROFESSIONAL' } },
      create: { userId, role: 'PROFESSIONAL' },
      update: {},
    });

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    });

    const profile = await db.professionalProfile.upsert({
      where: { userId },
      create: {
        userId,
        slug: slugify(user.name),
        title: pro.title,
        field: pro.field,
        bio: pro.bio,
        location: pro.location,
        skills: [...pro.skills],
        rateMinCents: pro.rateMinCents,
        rateMaxCents: pro.rateMaxCents,
        availability: pro.availability,
        verified: pro.verified,
        projectsCount: pro.projects,
        ratingSum: Math.round(4.8 * 12),
        ratingCount: 12,
      },
      update: {
        title: pro.title,
        field: pro.field,
        verified: pro.verified,
        projectsCount: pro.projects,
      },
      select: { id: true },
    });

    // Portfolio is replaced wholesale so re-seeding does not duplicate it.
    await db.portfolioItem.deleteMany({ where: { professionalId: profile.id } });
    await db.portfolioItem.createMany({
      data: pro.works.map(([title, meta], position) => ({
        professionalId: profile.id,
        title,
        description: `Projeto entregue: ${title}.`,
        meta,
        position,
      })),
    });
  }
  console.log(`  professional profiles: ${PROFESSIONALS.length}`);

  // --- Products -----------------------------------------------------------
  const productIds: string[] = [];
  let productIndex = 0;
  for (const item of PRODUCTS) {
    const authorId = creators.get(item.author);
    const categoryId = categories.get(item.category);
    if (!authorId || !categoryId) continue;

    const slug = slugify(item.name);
    const toolList = item.integrations.join(', ');
    // Every third product ships a demo video, so the product page exercises
    // both layouts. Placeholder ids — replace with real recordings.
    const hasVideo = productIndex % 3 === 0;
    productIndex += 1;

    const product = await db.product.upsert({
      where: { slug },
      create: {
        slug,
        name: item.name,
        tagline: item.tagline,
        descriptionMd: [
          `## O que o ${item.name} resolve`,
          '',
          item.tagline,
          '',
          `O que hoje consome horas da equipe passa a rodar sozinho, em cima de ${toolList} — as ferramentas que você já usa. Sem trocar de sistema, sem migrar base, sem projeto de seis meses.`,
          '',
          '## Como ele trabalha',
          '',
          'As regras de negócio são configuráveis por formulário: você define os critérios, os limites e o tom das respostas sem tocar em código. Cada execução fica registrada, então dá para auditar exatamente o que foi decidido e por quê.',
          '',
          'Quando alguma coisa foge do previsto, o fluxo para e avisa em vez de seguir adiante com dado errado. O painel acompanha volume, custo por execução e taxa de falha desde o primeiro dia em produção.',
          '',
          '## Para quem é',
          '',
          `Times que já usam ${toolList} e querem eliminar trabalho manual repetitivo. Funciona igualmente bem para uma operação enxuta que precisa ganhar escala e para um time grande que precisa padronizar o que hoje cada pessoa faz de um jeito.`,
          '',
          '## Para quem não é',
          '',
          'Se o seu processo ainda não está definido no papel, automatizar só vai acelerar a bagunça. Vale desenhar o fluxo antes — e nesse caso vale mais contratar um profissional na plataforma do que comprar um produto pronto.',
        ].join('\n'),
        videoUrl: hasVideo
          ? `https://www.youtube-nocookie.com/embed/demo-${slug}`
          : null,
        categoryId,
        authorId,
        priceCents: item.priceCents,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        submittedAt: new Date(),
        reviewedById: admin.id,
        reviewedAt: new Date(),
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
        integrations: [...item.integrations],
      },
      update: { status: 'PUBLISHED', priceCents: item.priceCents },
      select: { id: true },
    });

    productIds.push(product.id);

    // Gallery. The storage keys are deterministic placeholders — no bytes
    // exist in the bucket yet. The gallery falls back to a styled placeholder
    // when an image fails to load, so the layout is right either way and real
    // uploads drop straight in later.
    await db.productImage.deleteMany({ where: { productId: product.id } });
    await db.productImage.createMany({
      data: [
        `Tela principal do ${item.name}`,
        `Painel de acompanhamento do ${item.name}`,
        `Configuração das regras do ${item.name}`,
      ].map((alt, position) => ({
        productId: product.id,
        storageKey: `demo/products/${slug}/${position + 1}.png`,
        alt,
        width: 1280,
        height: 720,
        position,
      })),
    });

    // Tags
    for (const tagName of item.tags) {
      const tag = await db.tag.upsert({
        where: { slug: slugify(tagName) },
        create: { slug: slugify(tagName), name: tagName },
        update: {},
        select: { id: true },
      });
      await db.productTag.upsert({
        where: { productId_tagId: { productId: product.id, tagId: tag.id } },
        create: { productId: product.id, tagId: tag.id },
        update: {},
      });
    }

    // One deliverable per product, so the download flow has something to serve.
    const existingFile = await db.productFile.findFirst({
      where: { productId: product.id },
      select: { id: true },
    });

    if (!existingFile) {
      await db.productFile.create({
        data: {
          productId: product.id,
          storageKey: `product-file/seed/${slug}.zip`,
          fileName: `${slug}.zip`,
          contentType: 'application/zip',
          sizeBytes: 2_400_000,
          checksum: 'seed-placeholder-checksum',
          version: '1.0.0',
        },
      });
    }
  }
  console.log(`  products: ${productIds.length}`);

  // --- Orders + reviews ---------------------------------------------------
  // Gives the catalog real sales counts, real ratings and populated libraries.
  let orderCount = 0;
  let reviewCount = 0;

  for (const [index, productId] of productIds.entries()) {
    const product = await db.product.findUniqueOrThrow({
      where: { id: productId },
      select: { id: true, name: true, priceCents: true, authorId: true },
    });

    // Two buyers per product, skipping any buyer who owns it.
    for (let n = 0; n < 2; n += 1) {
      const buyerId = buyers[(index + n) % buyers.length];
      if (!buyerId || buyerId === product.authorId) continue;

      const existing = await db.orderItem.findFirst({
        where: { productId, order: { buyerId } },
        select: { id: true },
      });
      if (existing) continue;

      const feeCents = Math.round((product.priceCents * 1500) / 10_000);
      const sellerCents = product.priceCents - feeCents;
      const paidAt = new Date();
      paidAt.setDate(paidAt.getDate() - (index * 3 + n * 5));

      await db.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            number: `AUT-SEED${String(orderCount + 1).padStart(4, '0')}`,
            buyerId,
            status: 'PAID',
            subtotalCents: product.priceCents,
            feeCents,
            totalCents: product.priceCents,
            placedAt: paidAt,
            paidAt,
            items: {
              create: {
                productId: product.id,
                productName: product.name,
                unitCents: product.priceCents,
                quantity: 1,
                feeCents,
                sellerCents,
                sellerId: product.authorId,
              },
            },
          },
          select: { id: true },
        });

        await tx.product.update({
          where: { id: product.id },
          data: { salesCount: { increment: 1 } },
        });

        if (sellerCents > 0) {
          const scheduledFor = new Date(paidAt);
          scheduledFor.setDate(scheduledFor.getDate() + 15);
          await tx.payout.create({
            data: {
              sellerId: product.authorId,
              amountCents: sellerCents,
              status: scheduledFor < new Date() ? 'PAID' : 'SCHEDULED',
              scheduledFor,
              ...(scheduledFor < new Date() ? { paidAt: scheduledFor } : {}),
            },
          });
        }

        // First buyer of each product leaves a review.
        if (n === 0) {
          const rating = 4 + ((index + 1) % 2);
          await tx.review.create({
            data: {
              productId: product.id,
              authorId: buyerId,
              orderId: order.id,
              rating,
              comment: REVIEW_TEXTS[index % REVIEW_TEXTS.length]!,
            },
          });
          await tx.product.update({
            where: { id: product.id },
            data: {
              ratingSum: { increment: rating },
              ratingCount: { increment: 1 },
            },
          });
          reviewCount += 1;
        }
      });

      orderCount += 1;
    }
  }
  console.log(`  orders: ${orderCount}, reviews: ${reviewCount}`);

  // --- Demands + proposals ------------------------------------------------
  let proposalCount = 0;

  for (const [index, item] of DEMANDS.entries()) {
    const buyerId = buyers[index % buyers.length];
    if (!buyerId) continue;

    const slug = slugify(item.title);

    const demand = await db.demand.upsert({
      where: { slug },
      create: {
        slug,
        buyerId,
        title: item.title,
        problem: item.problem,
        goal: item.goal,
        details: item.details,
        category: item.category,
        tools: [...item.tools],
        budgetMinCents: item.budgetMinCents,
        budgetMaxCents: item.budgetMaxCents,
        deadlineWeeks: item.deadlineWeeks,
        status: 'OPEN',
      },
      update: {},
      select: { id: true },
    });

    // Three professionals propose on each demand.
    const proposers = PROFESSIONALS.slice(0, 3);

    for (const [pIndex, pro] of proposers.entries()) {
      const userId = creators.get(pro.email);
      if (!userId) continue;

      const profile = await db.professionalProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!profile) continue;

      const existing = await db.proposal.findUnique({
        where: {
          demandId_professionalId: {
            demandId: demand.id,
            professionalId: profile.id,
          },
        },
        select: { id: true },
      });
      if (existing) continue;

      await db.$transaction(async (tx) => {
        await tx.proposal.create({
          data: {
            demandId: demand.id,
            professionalId: profile.id,
            authorId: userId,
            priceCents:
              item.budgetMinCents + pIndex * Math.round(item.budgetMinCents * 0.35),
            deliveryWeeks: item.deadlineWeeks - pIndex,
            approach: `Começo pelo mapeamento do processo atual antes de escrever qualquer fluxo. A automação replica o que já funciona hoje, sem forçar mudança de rotina na equipe. ${pro.bio}`,
            deliverables: [
              'Solução publicada em produção',
              'Integrações configuradas',
              'Documentação de operação',
              '2 semanas de acompanhamento',
            ],
          },
        });

        await tx.demand.update({
          where: { id: demand.id },
          data: { proposalCount: { increment: 1 } },
        });
      });

      proposalCount += 1;
    }
  }
  console.log(`  demands: ${DEMANDS.length}, proposals: ${proposalCount}`);

  // --- Notifications ------------------------------------------------------
  const notificationSeed: Prisma.NotificationCreateManyInput[] = buyers
    .slice(0, 2)
    .map((userId) => ({
      userId,
      type: 'PURCHASE_COMPLETED' as const,
      title: 'Compra confirmada',
      body: 'Seus produtos estão disponíveis na biblioteca.',
      href: '/library',
    }));

  if (notificationSeed.length > 0) {
    const existing = await db.notification.count();
    if (existing === 0) {
      await db.notification.createMany({ data: notificationSeed });
    }
  }

  console.log('\nSeed complete.');
  console.log('  Admin:      admin@automatize.dev');
  console.log('  Criador:    lucas@automatize.dev');
  console.log('  Comprador:  comprador1@automatize.dev');
  console.log(`  Senha:      ${DEV_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
