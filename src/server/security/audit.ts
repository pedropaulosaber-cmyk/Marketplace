import 'server-only';
import { headers } from 'next/headers';
import { db, type Prisma } from '@/server/db/client';
import { hashIp } from './crypto';
import { securityLog } from '@/lib/logger';

/**
 * Audit logging.
 *
 * Every privileged or financially meaningful action writes a row here. The
 * table is append-only: nothing in the application ever updates or deletes an
 * audit record.
 *
 * When an audit write is part of a state change that must not happen
 * unrecorded (moderation, refunds, role grants), pass the surrounding
 * transaction client as `tx` so the record and the change commit together.
 */

export type AuditAction =
  // account
  | 'user.registered'
  | 'user.login'
  | 'user.login_failed'
  | 'user.logout'
  | 'user.password_changed'
  | 'user.role_granted'
  | 'user.role_revoked'
  | 'user.suspended'
  | 'user.reinstated'
  // catalog
  | 'product.created'
  | 'product.updated'
  | 'product.submitted'
  | 'product.approved'
  | 'product.rejected'
  | 'product.archived'
  | 'product.deleted'
  // commerce
  | 'order.created'
  | 'order.paid'
  | 'order.failed'
  | 'order.refunded'
  | 'payment.webhook_received'
  | 'payment.webhook_rejected'
  | 'payout.scheduled'
  | 'download.issued'
  // affiliate programme
  | 'affiliate.program.saved'
  | 'affiliate.joined'
  | 'affiliate.approved'
  | 'affiliate.rejected'
  | 'affiliate.blocked'
  // hiring
  | 'demand.created'
  | 'demand.updated'
  | 'demand.closed'
  | 'proposal.created'
  | 'proposal.accepted'
  | 'proposal.rejected'
  | 'proposal.withdrawn'
  // social
  | 'review.created'
  | 'review.replied'
  | 'review.removed';

export interface AuditInput {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

type DbClient = Pick<typeof db, 'auditLog'>;

/**
 * Writes an audit record.
 *
 * Never throws: a failure to audit must not roll back a user's successful
 * action when called outside a transaction. The failure is logged loudly so it
 * is visible in monitoring. Inside a transaction (`tx` supplied) the caller
 * decides the failure policy.
 */
export async function audit(
  input: AuditInput,
  tx?: DbClient
): Promise<void> {
  const client = tx ?? db;

  let ipHash: string | null = null;
  let userAgent: string | null = null;

  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ?? h.get('x-real-ip');
    ipHash = hashIp(ip);
    userAgent = h.get('user-agent')?.slice(0, 512) ?? null;
  } catch {
    // `headers()` is unavailable outside a request scope (background jobs,
    // webhook replays). The audit record is still worth writing without it.
  }

  const data = {
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
    ipHash,
    userAgent,
  };

  if (tx) {
    // Inside a transaction the caller wants atomicity — let errors propagate.
    await client.auditLog.create({ data });
    return;
  }

  try {
    await client.auditLog.create({ data });
  } catch (error) {
    securityLog.error(
      { err: error, action: input.action, entityId: input.entityId },
      'failed to write audit log'
    );
  }
}
