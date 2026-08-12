import 'server-only';
import { db } from '@/server/db/client';
import { requireUser } from '@/server/auth/rbac';
import { hasPurchased } from './order-service';
import { createDownloadUrl, isStorageConfigured } from '@/server/storage';
import { audit } from '@/server/security/audit';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { forbidden, notFound, unavailable } from '@/lib/errors';
import { securityLog } from '@/lib/logger';
import { headers } from 'next/headers';
import { hashIp } from '@/server/security/crypto';

/**
 * Secure digital delivery.
 *
 * Every download passes the same four gates, in order:
 *   1. Authenticated.
 *   2. Rate limited.
 *   3. Entitled — a PAID order containing this product exists for this user.
 *   4. Logged — before the URL is handed out, so an abusive pattern is
 *      visible even if the download itself is never completed.
 *
 * The storage key never leaves the server. What the browser receives is a
 * signed URL valid for minutes.
 */

/** Number of downloads of one file, by one user, per hour. */
const PER_FILE_HOURLY_CAP = 20;

export async function issueDownloadUrl(fileId: string): Promise<string> {
  const user = await requireUser();
  await enforceRateLimit('download', user.id);

  if (!isStorageConfigured) {
    throw unavailable(
      'A entrega de arquivos ainda não está configurada neste ambiente.'
    );
  }

  const file = await db.productFile.findFirst({
    where: { id: fileId, deletedAt: null },
    select: {
      id: true,
      storageKey: true,
      fileName: true,
      product: {
        select: { id: true, name: true, authorId: true, deletedAt: true },
      },
    },
  });

  if (!file || file.product.deletedAt) throw notFound('Arquivo não encontrado.');

  // The author always has access to their own deliverable; everyone else needs
  // a paid order.
  const isAuthor = file.product.authorId === user.id;
  const isAdmin = user.roles.includes('ADMIN');

  if (!isAuthor && !isAdmin) {
    const entitled = await hasPurchased(user.id, file.product.id);

    if (!entitled) {
      securityLog.warn(
        { userId: user.id, fileId, productId: file.product.id },
        'download attempt without entitlement'
      );
      // Same message as "not found": an unentitled user must not learn that
      // the file exists.
      throw forbidden('Arquivo não encontrado.');
    }

    // Abuse guard: a legitimate buyer does not need 20 copies an hour, but a
    // shared credential does.
    const since = new Date(Date.now() - 60 * 60_000);
    const recent = await db.downloadLog.count({
      where: { userId: user.id, fileId, createdAt: { gte: since } },
    });

    if (recent >= PER_FILE_HOURLY_CAP) {
      securityLog.warn(
        { userId: user.id, fileId, recent },
        'per-file download cap reached'
      );
      throw forbidden(
        'Limite de downloads deste arquivo atingido. Tente novamente mais tarde.'
      );
    }
  }

  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? h.get('x-real-ip');

  await db.downloadLog.create({
    data: {
      userId: user.id,
      productId: file.product.id,
      fileId: file.id,
      ipHash: hashIp(ip),
      userAgent: h.get('user-agent')?.slice(0, 512) ?? null,
    },
  });

  await audit({
    actorId: user.id,
    action: 'download.issued',
    entityType: 'ProductFile',
    entityId: file.id,
    metadata: { productId: file.product.id },
  });

  return createDownloadUrl(file.storageKey, file.fileName);
}
