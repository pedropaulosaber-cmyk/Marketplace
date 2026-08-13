import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  db,
  resetDatabase,
  createUser,
  createCategory,
  createCompany,
  createProduct,
} from './helpers';
import { listCompanies, getCompanyBySlug } from '@/server/services/company-service';
import { listFoundingCreators } from '@/server/services/creator-service';

/**
 * Partner companies and founding creators — both editorial designations
 * (see the schema comments on `Company` and `Profile.isFoundingCreator`),
 * never something a user sets on their own account.
 */

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe('company storefronts', () => {
  it('lists featured companies before the rest, then alphabetically', async () => {
    await createCompany({ name: 'Zeta Automação', featured: false });
    await createCompany({ name: 'Beta Ops', featured: true });
    await createCompany({ name: 'Alfa Vendas', featured: false });

    const companies = await listCompanies();

    expect(companies.map((c) => c.name)).toEqual([
      'Beta Ops',
      'Alfa Vendas',
      'Zeta Automação',
    ]);
  });

  it('excludes a soft-deleted company from the listing', async () => {
    const company = await createCompany({ name: 'Empresa Arquivada' });
    await db.company.update({
      where: { id: company.id },
      data: { deletedAt: new Date() },
    });

    const companies = await listCompanies();

    expect(companies.find((c) => c.id === company.id)).toBeUndefined();
  });

  it('returns a company with only its published products', async () => {
    const company = await createCompany({ name: 'TechFlow' });
    const author = await createUser({ roles: ['CREATOR'] });
    const categoryId = await createCategory();

    const published = await createProduct({
      authorId: author.id,
      categoryId,
      status: 'PUBLISHED',
    });
    const draft = await createProduct({
      authorId: author.id,
      categoryId,
      status: 'DRAFT',
    });

    await db.product.updateMany({
      where: { id: { in: [published.id, draft.id] } },
      data: { companyId: company.id },
    });

    const result = await getCompanyBySlug(company.slug);

    expect(result?.products.map((p) => p.id)).toEqual([published.id]);
  });

  it('returns null for an unknown slug', async () => {
    expect(await getCompanyBySlug('nao-existe')).toBeNull();
  });
});

describe('founding creators', () => {
  it('lists only creators flagged as founders', async () => {
    const founder = await createUser({ roles: ['CREATOR'], name: 'Fundadora' });
    await db.profile.update({
      where: { userId: founder.id },
      data: { isFoundingCreator: true, headline: 'Cofundadora' },
    });
    await createUser({ roles: ['CREATOR'], name: 'Criador Comum' });

    const founders = await listFoundingCreators();

    expect(founders).toHaveLength(1);
    expect(founders[0]?.name).toBe('Fundadora');
    expect(founders[0]?.profile?.headline).toBe('Cofundadora');
  });

  it('excludes a founder whose account is no longer active', async () => {
    const founder = await createUser({
      roles: ['CREATOR'],
      status: 'SUSPENDED',
    });
    await db.profile.update({
      where: { userId: founder.id },
      data: { isFoundingCreator: true },
    });

    const founders = await listFoundingCreators();

    expect(founders.find((f) => f.id === founder.id)).toBeUndefined();
  });

  it("shows only a founder's published products, capped at three", async () => {
    const founder = await createUser({ roles: ['CREATOR'] });
    await db.profile.update({
      where: { userId: founder.id },
      data: { isFoundingCreator: true },
    });
    const categoryId = await createCategory();

    for (let i = 0; i < 4; i += 1) {
      await createProduct({
        authorId: founder.id,
        categoryId,
        status: 'PUBLISHED',
        name: `Produto ${i}`,
      });
    }
    await createProduct({
      authorId: founder.id,
      categoryId,
      status: 'DRAFT',
      name: 'Rascunho não publicado',
    });

    const founders = await listFoundingCreators();
    const products = founders[0]?.products ?? [];

    expect(products).toHaveLength(3);
    expect(products.every((p) => !p.name.includes('Rascunho'))).toBe(true);
  });
});
