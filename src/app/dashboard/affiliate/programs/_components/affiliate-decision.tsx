'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { decideAffiliateAction } from '@/server/actions/affiliate-actions';

/** Approve, reject or block one affiliate on a programme the caller owns. */
export function AffiliateDecision({
  affiliateId,
  status,
}: {
  affiliateId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function decide(next: 'APPROVED' | 'REJECTED' | 'BLOCKED') {
    setError(undefined);

    startTransition(async () => {
      const result = await decideAffiliateAction({ affiliateId, status: next });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {status !== 'APPROVED' ? (
          <Button size="sm" onClick={() => decide('APPROVED')} disabled={pending}>
            Aprovar
          </Button>
        ) : null}

        {status === 'PENDING' ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => decide('REJECTED')}
            disabled={pending}
          >
            Recusar
          </Button>
        ) : null}

        {status === 'APPROVED' ? (
          <Button
            size="sm"
            variant="danger"
            onClick={() => decide('BLOCKED')}
            disabled={pending}
          >
            Bloquear
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
