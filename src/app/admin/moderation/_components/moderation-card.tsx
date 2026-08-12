'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormError, TextArea } from '@/components/ui/field';
import { moderateProductAction } from '@/server/actions/marketplace-actions';
import type { ActionResult } from '@/server/actions/action-result';

/**
 * Approve / reject controls for one queued product.
 *
 * Rejection requires a written reason — it is sent to the creator as a
 * notification, and a rejection with no explanation just produces a resubmit.
 */
export function ModerationCard({ productId }: { productId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(moderateProductAction, null);

  const [mode, setMode] = useState<'idle' | 'reject'>('idle');

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <FormError
        message={state?.ok === false && !state.fields ? state.error : undefined}
      />

      {mode === 'idle' ? (
        <div className="flex flex-wrap gap-3">
          <form action={formAction}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="decision" value="approve" />
            <Button type="submit" disabled={pending}>
              {pending ? 'Publicando…' : 'Aprovar e publicar'}
            </Button>
          </form>

          <Button
            variant="danger"
            onClick={() => setMode('reject')}
            disabled={pending}
          >
            Rejeitar
          </Button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="decision" value="reject" />

          <TextArea
            label="Motivo da rejeição"
            name="reason"
            required
            rows={3}
            minLength={5}
            maxLength={1000}
            placeholder="O que precisa ser corrigido antes de reenviar?"
            hint="O criador recebe este texto como notificação."
            error={state?.ok === false ? state.fields?.reason : undefined}
          />

          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? 'Enviando…' : 'Confirmar rejeição'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setMode('idle')}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
