import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  db,
  resetDatabase,
  createUser,
  createCategory,
  createProduct,
  signIn,
  signOut,
} from './helpers';
import {
  createProduct as createProductService,
  updateProduct,
  submitForReview,
  moderateProduct,
  archiveProduct,
  listProducts,
} from '@/server/services/product-service';
import {
  createDemand,
  createProposal,
  respondToProposal,
  getDemand,
} from '@/server/services/demand-service';
import { setUserRole, setUserStatus } from '@/server/services/admin-service';
import { productFiltersSchema } from '@/lib/validation/schemas';
import { isAppError } from '@/lib/errors';

/**
 * Product publishing, moderation, hiring and admin flows.
 */

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

const DRAFT = {
  name: 'Agente de Qualificação',
  tagline: 'Qualifica leads automaticamente e grava tudo no CRM.',
  descriptionMd:
    'Descrição longa o bastante para satisfazer a validação mínima de conteúdo do produto.',
  priceCents: 14_900,
  tags: ['Vendas'],
  benefits: ['Responde no seu tom.'],
  included: ['Fluxo pronto para importar'],
  requirements: ['Conta ativa no CRM'],
  compat: ['Web'],
  integrations: ['HubSpot'],
};

describe('product publishing', () => {
  it('creates a product as a draft, never published directly', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();
    await signIn(creator.id);

    const created = await createProductService({ ...DRAFT, categoryId });

    const product = await db.product.findUniqueOrThrow({
      where: { id: created.id },
      select: { status: true, authorId: true, publishedAt: true },
    });

    // Self-publication would bypass moderation entirely.
    expect(product.status).toBe('DRAFT');
    expect(product.publishedAt).toBeNull();
    // Authorship comes from the session, not from the request.
    expect(product.authorId).toBe(creator.id);
  });

  it('refuses product creation to a buyer', async () => {
    const buyer = await createUser({ roles: ['BUYER'] });
    const categoryId = await createCategory();
    await signIn(buyer.id);

    await expect(
      createProductService({ ...DRAFT, categoryId })
    ).rejects.toSatisfy((e: unknown) => isAppError(e) && e.code === 'FORBIDDEN');
  });

  it("refuses to let one creator edit another creator's product", async () => {
    const owner = await createUser({ roles: ['CREATOR'] });
    const other = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();

    const product = await createProduct({ authorId: owner.id, categoryId });

    await signIn(other.id);

    // Holding the CREATOR role is not enough — ownership is checked too.
    await expect(
      updateProduct(product.id, { name: 'Produto Sequestrado' })
    ).rejects.toSatisfy((e: unknown) => isAppError(e) && e.code === 'FORBIDDEN');

    const fresh = await db.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { name: true },
    });
    expect(fresh.name).not.toBe('Produto Sequestrado');
  });

  it('lets the owner edit their own product', async () => {
    const owner = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();
    const product = await createProduct({
      authorId: owner.id,
      categoryId,
      status: 'DRAFT',
    });

    await signIn(owner.id);
    await updateProduct(product.id, { name: 'Nome Atualizado' });

    const fresh = await db.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { name: true },
    });
    expect(fresh.name).toBe('Nome Atualizado');
  });

  it('refuses to submit a paid product with no deliverable', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();

    const product = await createProduct({
      authorId: creator.id,
      categoryId,
      priceCents: 9_900,
      status: 'DRAFT',
      withFile: false,
    });

    await signIn(creator.id);

    await expect(submitForReview(product.id)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'VALIDATION'
    );
  });

  it('moves a submitted product into the review queue', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();
    const product = await createProduct({
      authorId: creator.id,
      categoryId,
      status: 'DRAFT',
    });

    await signIn(creator.id);
    await submitForReview(product.id);

    const fresh = await db.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { status: true, submittedAt: true },
    });

    expect(fresh.status).toBe('PENDING_REVIEW');
    expect(fresh.submittedAt).not.toBeNull();
  });
});

describe('moderation', () => {
  it('refuses moderation to a non-admin, including the product owner', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();
    const product = await createProduct({
      authorId: creator.id,
      categoryId,
      status: 'PENDING_REVIEW',
    });

    await signIn(creator.id);

    // A creator approving their own product would defeat the whole queue.
    await expect(moderateProduct(product.id, 'approve')).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'FORBIDDEN'
    );

    const fresh = await db.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { status: true },
    });
    expect(fresh.status).toBe('PENDING_REVIEW');
  });

  it('publishes on admin approval and notifies the creator', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const admin = await createUser({ roles: ['ADMIN'] });
    const categoryId = await createCategory();
    const product = await createProduct({
      authorId: creator.id,
      categoryId,
      status: 'PENDING_REVIEW',
    });

    await signIn(admin.id);
    await moderateProduct(product.id, 'approve');

    const fresh = await db.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { status: true, publishedAt: true, reviewedById: true },
    });

    expect(fresh.status).toBe('PUBLISHED');
    expect(fresh.publishedAt).not.toBeNull();
    expect(fresh.reviewedById).toBe(admin.id);

    const notification = await db.notification.findFirst({
      where: { userId: creator.id, type: 'PRODUCT_APPROVED' },
    });
    expect(notification).not.toBeNull();
  });

  it('records the reason on rejection and tells the creator', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const admin = await createUser({ roles: ['ADMIN'] });
    const categoryId = await createCategory();
    const product = await createProduct({
      authorId: creator.id,
      categoryId,
      status: 'PENDING_REVIEW',
    });

    await signIn(admin.id);
    await moderateProduct(product.id, 'reject', 'Faltou documentação.');

    const fresh = await db.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { status: true, rejectionReason: true },
    });

    expect(fresh.status).toBe('REJECTED');
    expect(fresh.rejectionReason).toBe('Faltou documentação.');

    const notification = await db.notification.findFirst({
      where: { userId: creator.id, type: 'PRODUCT_REJECTED' },
    });
    expect(notification?.body).toContain('documentação');
  });

  it('writes an audit record for every moderation decision', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const admin = await createUser({ roles: ['ADMIN'] });
    const categoryId = await createCategory();
    const product = await createProduct({
      authorId: creator.id,
      categoryId,
      status: 'PENDING_REVIEW',
    });

    await signIn(admin.id);
    await moderateProduct(product.id, 'approve');

    const entry = await db.auditLog.findFirst({
      where: { entityType: 'Product', entityId: product.id, action: 'product.approved' },
      select: { actorId: true },
    });

    expect(entry?.actorId).toBe(admin.id);
  });
});

describe('catalog visibility', () => {
  it('lists only published products to the public', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();

    const published = await createProduct({
      authorId: creator.id,
      categoryId,
      status: 'PUBLISHED',
      name: 'Publicado',
    });
    await createProduct({
      authorId: creator.id,
      categoryId,
      status: 'DRAFT',
      name: 'Rascunho',
    });
    await createProduct({
      authorId: creator.id,
      categoryId,
      status: 'PENDING_REVIEW',
      name: 'Em revisão',
    });

    signOut();

    const result = await listProducts(productFiltersSchema.parse({}));
    const ids = result.items.map((p) => p.id);

    expect(ids).toEqual([published.id]);
  });

  it('excludes an archived product from the catalog', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();
    const product = await createProduct({ authorId: creator.id, categoryId });

    await signIn(creator.id);
    await archiveProduct(product.id);

    const result = await listProducts(productFiltersSchema.parse({}));
    expect(result.items).toHaveLength(0);

    // Soft delete: the row survives so purchase history stays intact.
    const row = await db.product.findUnique({ where: { id: product.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
  });
});

describe('demands and proposals', () => {
  const DEMAND = {
    title: 'Automatizar o atendimento no WhatsApp',
    problem:
      'Três pessoas revezam o WhatsApp da empresa e nada fica registrado no CRM.',
    goal: 'Reduzir o tempo de primeira resposta para menos de dois minutos.',
    details:
      'Queremos um agente que responda, qualifique o lead e grave tudo automaticamente.',
    category: 'Atendimento',
    tools: ['WhatsApp'],
    budgetMinCents: 600_000,
    budgetMaxCents: 1_200_000,
    deadlineWeeks: 6,
  };

  async function proposalSetup() {
    const buyer = await createUser({ roles: ['BUYER'] });
    const pro = await createUser({ roles: ['PROFESSIONAL'] });

    const profile = await db.professionalProfile.create({
      data: {
        userId: pro.id,
        slug: `pro-${pro.id.slice(-8)}`,
        title: 'Especialista',
        field: 'Atendimento',
        bio: 'Bio suficientemente longa para o perfil profissional de teste.',
        location: 'Brasil',
        rateMinCents: 100_000,
        rateMaxCents: 900_000,
      },
      select: { id: true },
    });

    await signIn(buyer.id);
    const demand = await createDemand(DEMAND);

    return { buyer, pro, profile, demand };
  }

  it('records the demand owner from the session', async () => {
    const { buyer, demand } = await proposalSetup();

    const row = await db.demand.findUniqueOrThrow({
      where: { id: demand.id },
      select: { buyerId: true, status: true },
    });

    expect(row.buyerId).toBe(buyer.id);
    expect(row.status).toBe('OPEN');
  });

  it('refuses a proposal from a buyer with no professional profile', async () => {
    const { demand } = await proposalSetup();
    const plainBuyer = await createUser({ roles: ['BUYER'] });
    await signIn(plainBuyer.id);

    await expect(
      createProposal({
        demandId: demand.id,
        priceCents: 800_000,
        deliveryWeeks: 4,
        approach:
          'Uma abordagem descrita com detalhe suficiente para passar na validação.',
        deliverables: ['Agente publicado'],
      })
    ).rejects.toThrow();
  });

  it('refuses a proposal on your own demand', async () => {
    const { buyer, demand } = await proposalSetup();

    await db.userRole.create({
      data: { userId: buyer.id, role: 'PROFESSIONAL' },
    });
    await db.professionalProfile.create({
      data: {
        userId: buyer.id,
        slug: `self-${buyer.id.slice(-8)}`,
        title: 'Especialista',
        field: 'Atendimento',
        bio: 'Bio suficientemente longa para o perfil profissional de teste.',
        location: 'Brasil',
        rateMinCents: 0,
        rateMaxCents: 0,
      },
    });

    await signIn(buyer.id);

    await expect(
      createProposal({
        demandId: demand.id,
        priceCents: 800_000,
        deliveryWeeks: 4,
        approach:
          'Uma abordagem descrita com detalhe suficiente para passar na validação.',
        deliverables: ['Agente publicado'],
      })
    ).rejects.toThrow();
  });

  it('refuses a duplicate proposal on the same demand', async () => {
    const { pro, demand } = await proposalSetup();
    await signIn(pro.id);

    const payload = {
      demandId: demand.id,
      priceCents: 800_000,
      deliveryWeeks: 4,
      approach:
        'Uma abordagem descrita com detalhe suficiente para passar na validação.',
      deliverables: ['Agente publicado'],
    };

    await createProposal(payload);

    await expect(createProposal(payload)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'CONFLICT'
    );
  });

  it('hides competing proposals from a rival professional', async () => {
    const { pro, demand } = await proposalSetup();

    await signIn(pro.id);
    await createProposal({
      demandId: demand.id,
      priceCents: 800_000,
      deliveryWeeks: 4,
      approach:
        'Uma abordagem descrita com detalhe suficiente para passar na validação.',
      deliverables: ['Agente publicado'],
    });

    // A second professional must not be able to read the first one's price.
    const rival = await createUser({ roles: ['PROFESSIONAL'] });
    await db.professionalProfile.create({
      data: {
        userId: rival.id,
        slug: `rival-${rival.id.slice(-8)}`,
        title: 'Especialista',
        field: 'Atendimento',
        bio: 'Bio suficientemente longa para o perfil profissional de teste.',
        location: 'Brasil',
        rateMinCents: 0,
        rateMaxCents: 0,
      },
    });

    await signIn(rival.id);
    const view = await getDemand(demand.id);

    expect(view.canSeeAllProposals).toBe(false);
    expect(view.proposals).toHaveLength(0);
  });

  it('shows every proposal to the demand owner', async () => {
    const { buyer, pro, demand } = await proposalSetup();

    await signIn(pro.id);
    await createProposal({
      demandId: demand.id,
      priceCents: 800_000,
      deliveryWeeks: 4,
      approach:
        'Uma abordagem descrita com detalhe suficiente para passar na validação.',
      deliverables: ['Agente publicado'],
    });

    await signIn(buyer.id);
    const view = await getDemand(demand.id);

    expect(view.isOwner).toBe(true);
    expect(view.proposals).toHaveLength(1);
  });

  it('refuses a decision from anyone but the demand owner', async () => {
    const { pro, demand } = await proposalSetup();

    await signIn(pro.id);
    const proposal = await createProposal({
      demandId: demand.id,
      priceCents: 800_000,
      deliveryWeeks: 4,
      approach:
        'Uma abordagem descrita com detalhe suficiente para passar na validação.',
      deliverables: ['Agente publicado'],
    });

    // The professional trying to accept their own proposal.
    await expect(respondToProposal(proposal.id, 'accept')).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'FORBIDDEN'
    );
  });

  it('accepting one proposal rejects the others and closes the demand', async () => {
    const { buyer, pro, demand } = await proposalSetup();

    await signIn(pro.id);
    const accepted = await createProposal({
      demandId: demand.id,
      priceCents: 800_000,
      deliveryWeeks: 4,
      approach:
        'Uma abordagem descrita com detalhe suficiente para passar na validação.',
      deliverables: ['Agente publicado'],
    });

    const rival = await createUser({ roles: ['PROFESSIONAL'] });
    const rivalProfile = await db.professionalProfile.create({
      data: {
        userId: rival.id,
        slug: `rival2-${rival.id.slice(-8)}`,
        title: 'Especialista',
        field: 'Atendimento',
        bio: 'Bio suficientemente longa para o perfil profissional de teste.',
        location: 'Brasil',
        rateMinCents: 0,
        rateMaxCents: 0,
      },
      select: { id: true },
    });

    const other = await db.proposal.create({
      data: {
        demandId: demand.id,
        professionalId: rivalProfile.id,
        authorId: rival.id,
        priceCents: 700_000,
        deliveryWeeks: 5,
        approach: 'Outra abordagem igualmente detalhada para efeito de teste.',
        deliverables: ['Entrega'],
      },
      select: { id: true },
    });

    await signIn(buyer.id);
    await respondToProposal(accepted.id, 'accept');

    const [winner, loser, updatedDemand] = await Promise.all([
      db.proposal.findUniqueOrThrow({ where: { id: accepted.id } }),
      db.proposal.findUniqueOrThrow({ where: { id: other.id } }),
      db.demand.findUniqueOrThrow({ where: { id: demand.id } }),
    ]);

    expect(winner.status).toBe('ACCEPTED');
    expect(loser.status).toBe('REJECTED');
    expect(updatedDemand.status).toBe('AWARDED');
  });
});

describe('admin safeguards', () => {
  it('refuses to suspend the acting admin', async () => {
    const admin = await createUser({ roles: ['ADMIN'] });
    await signIn(admin.id);

    await expect(setUserStatus(admin.id, 'SUSPENDED')).rejects.toThrow();
  });

  it('refuses to remove the last remaining admin', async () => {
    const admin = await createUser({ roles: ['ADMIN'] });
    const other = await createUser({ roles: ['ADMIN'] });
    await signIn(admin.id);

    // Two admins exist, so one can be demoted.
    await setUserRole(other.id, 'ADMIN', 'revoke');

    // Now only one remains and the platform must refuse to remove it.
    await expect(setUserRole(admin.id, 'ADMIN', 'revoke')).rejects.toThrow();
  });

  it('revokes live sessions when an account is suspended', async () => {
    const admin = await createUser({ roles: ['ADMIN'] });
    const target = await createUser({ roles: ['CREATOR'] });

    await signIn(target.id);
    const before = await db.session.count({
      where: { userId: target.id, revokedAt: null },
    });
    expect(before).toBe(1);

    await signIn(admin.id);
    await setUserStatus(target.id, 'SUSPENDED', 'Violação dos termos');

    const after = await db.session.count({
      where: { userId: target.id, revokedAt: null },
    });
    expect(after).toBe(0);
  });

  it('refuses admin operations to a non-admin', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    const victim = await createUser({ roles: ['BUYER'] });
    await signIn(creator.id);

    await expect(setUserStatus(victim.id, 'BANNED')).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'FORBIDDEN'
    );
    await expect(setUserRole(creator.id, 'ADMIN', 'grant')).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'FORBIDDEN'
    );
  });
});
