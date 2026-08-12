'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/field';
import { respondProposalAction } from '@/server/actions/marketplace-actions';

/**
 * Accept / reject controls, shown only to the demand's owner.
 *
 * Accepting is consequential — it rejects every competing proposal and closes
 * the demand — so it asks for confirmation first rather than firing on a
 * single click.
 */
export function ProposalDecision({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  function respond(decision: 'accept' | 'reject') {
    setError(undefined);

    startTransition(async () => {
      const result = await respondProposalAction(proposalId, decision);

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
      <div className="mt-5 rounded-[10px] border border-line bg-sky p-4">
        <p className="text-[13.5px] leading-[1.5] font-semibold">
          Aceitar esta proposta encerra a demanda e recusa automaticamente as
          demais. Confirmar?
        </p>
        <div className="mt-3 flex gap-3">
          <Button size="sm" onClick={() => respond('accept')} disabled={pending}>
            {pending ? 'Confirmando…' : 'Sim, aceitar'}
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
    <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap gap-3">
        <Button size="sm" onClick={() => setConfirming(true)} disabled={pending}>
          Aceitar proposta
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => respond('reject')}
          disabled={pending}
        >
          {pending ? 'Processando…' : 'Recusar'}
        </Button>
      </div>
      <FormError message={error} />
    </div>
  );
}
