'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  setUserRoleAction,
  setUserStatusAction,
} from '@/server/actions/marketplace-actions';

/**
 * Per-user admin actions.
 *
 * Suspending revokes every live session immediately, so it asks for
 * confirmation first. The server independently refuses to suspend the acting
 * admin or to remove the last remaining admin.
 */
export function UserRowActions({
  userId,
  status,
  roles,
}: {
  userId: string;
  status: string;
  roles: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  const isCreator = roles.includes('CREATOR');

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(undefined);

    startTransition(async () => {
      const result = await fn();

      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }

      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {status === 'ACTIVE' ? (
          confirming ? (
            <>
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setUserStatusAction(userId, 'SUSPENDED', 'Suspenso pelo admin')
                  )
                }
              >
                Confirmar suspensão
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              Suspender
            </Button>
          )
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => setUserStatusAction(userId, 'ACTIVE'))}
          >
            Reativar
          </Button>
        )}

        {!isCreator ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => setUserRoleAction(userId, 'CREATOR', 'grant'))}
          >
            Tornar criador
          </Button>
        ) : null}
      </div>

      {error ? (
        <span role="alert" className="text-[12px] font-medium text-danger-fg">
          {error}
        </span>
      ) : null}
    </div>
  );
}
