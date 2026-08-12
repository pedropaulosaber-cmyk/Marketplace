import 'server-only';
import type { Role } from '@prisma/client';
import { getSession, type SessionUser } from './session';
import { forbidden, unauthenticated } from '@/lib/errors';
import { securityLog } from '@/lib/logger';

/**
 * Role-based access control.
 *
 * Two distinct checks exist and both matter:
 *
 *   1. *Capability* — may a user of this role perform this kind of action?
 *   2. *Ownership*  — may this specific user act on this specific record?
 *
 * Role alone is never sufficient for a resource-scoped action. A CREATOR may
 * edit products in general, but only *their* products. Every service that
 * touches a user-owned row calls `assertOwnership` (or scopes the query by
 * owner id) in addition to the role check. This is the IDOR defence.
 */

export const PERMISSIONS = {
  // Catalog
  'product:create': ['CREATOR', 'ADMIN'],
  'product:update': ['CREATOR', 'ADMIN'],
  'product:delete': ['CREATOR', 'ADMIN'],
  'product:publish': ['CREATOR', 'ADMIN'],
  'product:moderate': ['ADMIN'],

  // Commerce
  'order:create': ['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'],
  'order:read:own': ['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'],
  'order:read:any': ['ADMIN'],

  // Social
  'review:create': ['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'],
  'review:reply': ['CREATOR', 'ADMIN'],
  'review:moderate': ['ADMIN'],
  'favorite:manage': ['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'],

  // Hiring
  'demand:create': ['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'],
  'demand:manage:own': ['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'],
  'proposal:create': ['PROFESSIONAL', 'ADMIN'],
  'proposal:respond': ['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'],
  'professional:manage:own': ['PROFESSIONAL', 'ADMIN'],

  // Running a programme is a seller capability; joining one is open to any
  // signed-in account, which is the whole point of an affiliate channel.
  'affiliate:program:manage': ['CREATOR', 'ADMIN'],
  'affiliate:join': ['BUYER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'],

  // Platform
  'admin:access': ['ADMIN'],
  'user:manage': ['ADMIN'],
  'category:manage': ['ADMIN'],
  'transaction:manage': ['ADMIN'],
  'audit:read': ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(user: SessionUser, role: Role): boolean {
  return user.roles.includes(role);
}

export function isAdmin(user: SessionUser | null): boolean {
  return !!user && user.roles.includes('ADMIN');
}

export function can(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  const allowed: readonly Role[] = PERMISSIONS[permission];
  return user.roles.some((r) => allowed.includes(r));
}

// --- Assertions used by services -------------------------------------------

/** Returns the signed-in user or throws 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw unauthenticated();
  return user;
}

/** Returns the signed-in user, or throws 401/403 if they lack `permission`. */
export async function requirePermission(
  permission: Permission
): Promise<SessionUser> {
  const user = await requireUser();

  if (!can(user, permission)) {
    // Denials are security-relevant: a burst of them is an attack signal.
    securityLog.warn(
      { userId: user.id, permission, roles: user.roles },
      'permission denied'
    );
    throw forbidden();
  }

  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requirePermission('admin:access');
}

/**
 * Resource-level check. Admins bypass ownership by design; everyone else must
 * be the owner of the record.
 *
 * Throws the same generic error as a missing record so an attacker cannot use
 * the difference to discover which ids exist.
 */
export function assertOwnership(
  user: SessionUser,
  ownerId: string,
  context: { entityType: string; entityId: string }
): void {
  if (isAdmin(user)) return;
  if (user.id === ownerId) return;

  securityLog.warn(
    {
      userId: user.id,
      ownerId,
      ...context,
    },
    'ownership violation blocked'
  );
  throw forbidden();
}

/** Convenience: signed-in user, or null. Never throws. */
export async function currentUser(): Promise<SessionUser | null> {
  return getSession();
}
