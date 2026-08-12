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
  for (const item of PRODUCTS) {
    const authorId = creators.get(item.author);
    const categoryId = categories.get(item.category);
    if (!authorId || !categoryId) continue;

    const slug = slugify(item.name);

    const product = await db.product.upsert({
      where: { slug },
      create: {
        slug,
        name: item.name,
        tagline: item.tagline,
        descriptionMd: [
          `## O que ${item.name} resolve`,
          '',
          item.tagline,
          '',
          'Esta solução foi construída para entrar em produção rápido: as regras de negócio são configuráveis por formulário, cada execução fica registrada para auditoria, e o painel acompanha volume, custo e falhas desde o primeiro dia.',
          '',
          '## Para quem é',
          '',
          'Times que já usam as ferramentas listadas em integrações e querem eliminar trabalho manual repetitivo sem trocar o sistema que já funciona.',
        ].join('\n'),
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
