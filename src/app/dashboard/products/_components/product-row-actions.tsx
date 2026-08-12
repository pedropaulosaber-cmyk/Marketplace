'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  archiveProductAction,
  submitProductAction,
} from '@/server/actions/marketplace-actions';

/**
 * Per-row product actions.
 *
 * Which buttons appear depends on the product's state; the server re-checks
 * the same transitions, so a stale row cannot be used to force an invalid one.
 */
export function ProductRowActions({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const canSubmit = status === 'DRAFT' || status === 'REJECTED';
  const canArchive = status !== 'ARCHIVED';

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(undefined);

    startTransition(async () => {
      const result = await fn();

      if (!result.ok) {
        setError(result.error);
        setConfirmingArchive(false);
        return;
      }

      setConfirmingArchive(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {canSubmit ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => submitProductAction(productId))}
          >
            {pending ? '…' : 'Enviar para revisão'}
          </Button>
        ) : null}

        {canArchive ? (
          confirmingArchive ? (
            <>
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() => run(() => archiveProductAction(productId))}
              >
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => setConfirmingArchive(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirmingArchive(true)}
            >
              Arquivar
            </Button>
          )
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
