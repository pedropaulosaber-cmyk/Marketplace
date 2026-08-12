'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, FormSuccess, TextArea } from '@/components/ui/field';
import { createReviewAction } from '@/server/actions/marketplace-actions';
import type { ActionResult } from '@/server/actions/action-result';
import { cn } from '@/lib/cn';

/**
 * Review form.
 *
 * Only rendered when the server has already confirmed this user may review
 * (bought it, has not reviewed it yet). The action re-checks both conditions —
 * this component's presence is a UI hint, never the authorization.
 */
export function ReviewForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(createReviewAction, null);

  const [rating, setRating] = useState(5);

  if (state?.ok) {
    return (
      <div className="mt-4">
        <FormSuccess message="Avaliação publicada. Obrigado pelo retorno." />
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />

      <fieldset className="border-0 p-0">
        <legend className="text-[12.5px] font-bold text-[#334155]">
          Sua nota
        </legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              aria-label={`${star} ${star === 1 ? 'estrela' : 'estrelas'}`}
              aria-pressed={rating === star}
              className={cn(
                'cursor-pointer rounded px-1 text-[26px] leading-none transition-colors',
                star <= rating ? 'text-star' : 'text-line hover:text-star/50'
              )}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <TextArea
        label="Comentário"
        name="comment"
        rows={4}
        required
        minLength={10}
        maxLength={2000}
        placeholder="O que funcionou bem? O que exigiu mais trabalho do que você esperava?"
        error={state?.ok === false ? state.fields?.comment : undefined}
      />

      <FormError
        message={state?.ok === false && !state.fields ? state.error : undefined}
      />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Publicando…' : 'Publicar avaliação'}
        </Button>
      </div>
    </form>
  );
}
