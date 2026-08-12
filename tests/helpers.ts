import { PrismaClient, type Role } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { testCookies } from './setup';
import { __resetRateLimits } from '@/server/security/rate-limit';

/**
 * Shared test fixtures.
 *
 * Every helper writes to the real test database, so a test that passes here
 * has satisfied the same constraints production would enforce.
 */

export const db = new PrismaClient();

const ARGON = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const TEST_PASSWORD = 'test-password-1234';

let passwordHashCache: string | null = null;

async function testPasswordHash(): Promise<string> {
  passwordHashCache ??= await hash(TEST_PASSWORD, ARGON);
  return passwordHashCache;
}

let counter = 0;
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Wipes every table. Order respects foreign keys. */
export async function resetDatabase(): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, notifications, messages, conversation_participants,
      conversations, proposals, demands, services, portfolio_items,
      professional_profiles, favorites, review_replies, reviews,
      download_logs, payouts, processed_webhook_events, payments,
      order_items, orders, product_tags, product_files, product_images,
      products, tags, categories, sessions, user_roles, profiles, users
    RESTART IDENTITY CASCADE
  `);

  testCookies.clear();
  await __resetRateLimits();
}

export async function createUser(options?: {
  roles?: Role[];
  email?: string;
  name?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
}): Promise<{ id: string; email: string; name: string }> {
  const email = options?.email ?? `${unique('user')}@test.dev`;
  const name = options?.name ?? 'Usuário de Teste';

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash: await testPasswordHash(),
      status: options?.status ?? 'ACTIVE',
      profile: { create: {} },
      roles: {
        create: (options?.roles ?? ['BUYER']).map((role) => ({ role })),
      },
    },
    select: { id: true, email: true, name: true },
  });

  return user;
}

export async function createCategory(name = 'AI Agents'): Promise<string> {
  const slug = unique('cat');
  const category = await db.category.create({
    data: { slug, name },
    select: { id: true },
  });
  return category.id;
}

export async function createProduct(options: {
  authorId: string;
  categoryId: string;
  priceCents?: number;
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
  name?: string;
  withFile?: boolean;
}): Promise<{ id: string; slug: string }> {
  const slug = unique('produto');

  const product = await db.product.create({
    data: {
      slug,
      name: options.name ?? 'Produto de Teste',
      tagline: 'Automatiza uma tarefa repetitiva do time comercial.',
      descriptionMd:
        'Descrição longa o suficiente para passar na validação de conteúdo do produto.',
      categoryId: options.categoryId,
      authorId: options.authorId,
      priceCents: options.priceCents ?? 10_000,
      status: options.status ?? 'PUBLISHED',
      publishedAt: options.status === 'PUBLISHED' ? new Date() : null,
    },
    select: { id: true, slug: true },
  });

  if (options.withFile !== false) {
    await db.productFile.create({
      data: {
        productId: product.id,
        storageKey: `product-file/test/${slug}.zip`,
        fileName: `${slug}.zip`,
        contentType: 'application/zip',
        sizeBytes: 1024,
        checksum: 'test-checksum',
      },
    });
  }

  return product;
}

/**
 * Creates a settled order, the way the webhook would. Used to give a buyer a
 * real entitlement so download and review paths can be tested.
 */
export async function createPaidOrder(options: {
  buyerId: string;
  productId: string;
}): Promise<{ id: string; number: string }> {
  const product = await db.product.findUniqueOrThrow({
    where: { id: options.productId },
    select: { name: true, priceCents: true, authorId: true },
  });

  const feeCents = Math.round((product.priceCents * 1500) / 10_000);

  const order = await db.order.create({
    data: {
      number: unique('AUT').toUpperCase().slice(0, 20),
      buyerId: options.buyerId,
      status: 'PAID',
      subtotalCents: product.priceCents,
      feeCents,
      totalCents: product.priceCents,
      paidAt: new Date(),
      items: {
        create: {
          productId: options.productId,
          productName: product.name,
          unitCents: product.priceCents,
          quantity: 1,
          feeCents,
          sellerCents: product.priceCents - feeCents,
          sellerId: product.authorId,
        },
      },
    },
    select: { id: true, number: true },
  });

  return order;
}

/**
 * Signs a user in for subsequent service calls by creating a real session and
 * putting its token in the mocked cookie jar — the same path the login action
 * takes.
 */
export async function signIn(userId: string): Promise<void> {
  const { createSession } = await import('@/server/auth/session');
  testCookies.clear();
  await createSession(userId);
}

export function signOut(): void {
  testCookies.clear();
}
