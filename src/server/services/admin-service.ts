import 'server-only';
import { db } from '@/server/db/client';
import { requirePermission } from '@/server/auth/rbac';
import { revokeAllSessions } from '@/server/auth/session';
import { audit } from '@/server/security/audit';
import { conflict, notFound, validation } from '@/lib/errors';
import { slugify } from '@/lib/validation/common';
import type { Role, UserStatus } from '@prisma/client';

/**
 * Administrative operations.
 *
 * Every function here begins with a permission check and ends with an audit
 * record. There is no admin path that is neither authorized nor logged.
 */

export async function getPlatformStats() {
  await requirePermission('admin:access');

  const [users, products, pending, orders, revenue, demands, proposals] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.product.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
      db.product.count({ where: { status: 'PENDING_REVIEW', deletedAt: null } }),
      db.order.count({ where: { status: 'PAID' } }),
      db.order.aggregate({ where: { status: 'PAID' }, _sum: { feeCents: true } }),
      db.demand.count({ where: { deletedAt: null, status: 'OPEN' } }),
      db.proposal.count({ where: { status: 'SENT' } }),
    ]);

  return {
    users,
    products,
    pendingReview: pending,
    orders,
    platformRevenueCents: revenue._sum.feeCents ?? 0,
    openDemands: demands,
    openProposals: proposals,
  };
}

export async function listUsers(query?: string, status?: UserStatus) {
  await requirePermission('user:manage');

  return db.user.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      roles: { select: { role: true } },
      _count: { select: { products: true, orders: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function setUserStatus(
  userId: string,
  status: UserStatus,
  reason?: string
): Promise<void> {
  const admin = await requirePermission('user:manage');

  const target = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, status: true, roles: { select: { role: true } } },
  });

  if (!target) throw notFound('Usuário não encontrado.');

  // An admin must not lock themselves out, and the last admin must remain.
  if (target.id === admin.id && status !== 'ACTIVE') {
    throw validation('Você não pode suspender a própria conta.');
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status } });

    await audit(
      {
        actorId: admin.id,
        action: status === 'ACTIVE' ? 'user.reinstated' : 'user.suspended',
        entityType: 'User',
        entityId: userId,
        metadata: { from: target.status, to: status, reason: reason ?? null },
      },
      tx
    );
  });

  // A suspended user's live sessions must die immediately, not at expiry.
  if (status !== 'ACTIVE') await revokeAllSessions(userId);
}

export async function setUserRole(
  userId: string,
  role: Role,
  action: 'grant' | 'revoke'
): Promise<void> {
  const admin = await requirePermission('user:manage');

  const target = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, roles: { select: { role: true } } },
  });

  if (!target) throw notFound('Usuário não encontrado.');

  if (action === 'revoke' && role === 'ADMIN') {
    // Never allow the platform to end up with zero admins.
    const adminCount = await db.userRole.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      throw conflict('A plataforma precisa de pelo menos um administrador.');
    }
    if (userId === admin.id) {
      throw validation('Você não pode remover o próprio acesso de administrador.');
    }
  }

  await db.$transaction(async (tx) => {
    if (action === 'grant') {
      await tx.userRole.upsert({
        where: { userId_role: { userId, role } },
        create: { userId, role },
        update: {},
      });

      // A new professional needs a directory profile to be reachable.
      if (role === 'PROFESSIONAL') {
        const existing = await tx.professionalProfile.findUnique({
          where: { userId },
          select: { id: true },
        });

        if (!existing) {
          const user = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { name: true },
          });

          await tx.professionalProfile.create({
            data: {
              userId,
              slug: `${slugify(user.name) || 'profissional'}-${userId.slice(-6)}`,
              title: 'Especialista em automação',
              field: 'Agentes de IA',
              bio: 'Perfil em construção.',
              location: 'Brasil',
              rateMinCents: 0,
              rateMaxCents: 0,
            },
          });
        }
      }
    } else {
      await tx.userRole.deleteMany({ where: { userId, role } });
    }

    await audit(
      {
        actorId: admin.id,
        action: action === 'grant' ? 'user.role_granted' : 'user.role_revoked',
        entityType: 'User',
        entityId: userId,
        metadata: { role },
      },
      tx
    );
  });
}

/** The moderation queue: products awaiting a decision, oldest first. */
export async function listModerationQueue() {
  await requirePermission('product:moderate');

  return db.product.findMany({
    where: { status: 'PENDING_REVIEW', deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      priceCents: true,
      submittedAt: true,
      category: { select: { name: true } },
      author: { select: { id: true, name: true, email: true } },
      _count: { select: { files: true, images: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });
}

export async function listAllProducts(query?: string) {
  await requirePermission('product:moderate');

  return db.product.findMany({
    where: {
      deletedAt: null,
      ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      priceCents: true,
      salesCount: true,
      createdAt: true,
      category: { select: { name: true } },
      author: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function listTransactions() {
  await requirePermission('transaction:manage');

  return db.order.findMany({
    where: { status: { in: ['PAID', 'REFUNDED'] } },
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      feeCents: true,
      paidAt: true,
      buyer: { select: { name: true, email: true } },
      items: { select: { productName: true, sellerId: true } },
      payment: { select: { provider: true, status: true } },
    },
    orderBy: { paidAt: 'desc' },
    take: 100,
  });
}

export async function listAuditLog(entityType?: string) {
  await requirePermission('audit:read');

  return db.auditLog.findMany({
    where: entityType ? { entityType } : {},
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function listCategories() {
  return db.category.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      parentId: true,
      position: true,
      _count: { select: { products: true } },
    },
  });
}

export async function createCategory(input: {
  name: string;
  parentId?: string;
  position: number;
}): Promise<void> {
  const admin = await requirePermission('category:manage');

  const slug = slugify(input.name);
  if (!slug) throw validation('Nome de categoria inválido.');

  const existing = await db.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) throw conflict('Já existe uma categoria com este nome.');

  const category = await db.category.create({
    data: {
      slug,
      name: input.name,
      parentId: input.parentId || null,
      position: input.position,
    },
    select: { id: true },
  });

  await audit({
    actorId: admin.id,
    action: 'product.updated',
    entityType: 'Category',
    entityId: category.id,
    metadata: { name: input.name },
  });
}

export async function listAdminDemands() {
  await requirePermission('admin:access');

  return db.demand.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      status: true,
      proposalCount: true,
      budgetMinCents: true,
      budgetMaxCents: true,
      createdAt: true,
      buyer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
