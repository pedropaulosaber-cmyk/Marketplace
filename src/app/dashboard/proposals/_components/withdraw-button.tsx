'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { withdrawProposalAction } from '@/server/actions/marketplace-actions';

/**
 * Withdraw an unanswered proposal.
 *
 * Confirms first — withdrawing is irreversible, and the professional cannot
 * submit a second proposal for the same demand.
 */
export function WithdrawProposalButton({
  proposalId,
}: {
  proposalId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  function withdraw() {
    setError(undefined);

    startTransition(async () => {
      const result = await withdrawProposalAction(proposalId);

      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }

      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold">
          Retirar a proposta é definitivo — você não poderá enviar outra para
          esta demanda.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="danger" onClick={withdraw} disabled={pending}>
            {pending ? 'Retirando…' : 'Sim, retirar'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setConfirming(true)}
          disabled={pending}
        >
          Retirar proposta
        </Button>
      </div>
      {error ? (
        <span role="alert" className="text-[12px] font-medium text-danger-fg">
          {error}
        </span>
      ) : null}
    </div>
  );
}
