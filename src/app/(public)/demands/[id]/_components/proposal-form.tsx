'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  FormError,
  FormSuccess,
  TextArea,
  TextField,
} from '@/components/ui/field';
import { createProposalAction } from '@/server/actions/marketplace-actions';
import type { ActionResult } from '@/server/actions/action-result';

/**
 * Proposal submission.
 *
 * Rendered only when the server has already established this viewer is an
 * eligible professional; the action independently re-checks role, ownership,
 * demand state and duplicate submission.
 */
export function ProposalForm({ demandId }: { demandId: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(createProposalAction, null);

  if (state?.ok) {
    return (
      <div className="mt-5">
        <FormSuccess message="Proposta enviada. O cliente foi notificado e pode responder pela plataforma." />
      </div>
    );
  }

  const fieldError = (name: string) =>
    state?.ok === false ? state.fields?.[name] : undefined;

  return (
    <form
      action={formAction}
      className="mt-5 flex flex-col gap-5 rounded-[14px] border border-line bg-bg p-6 max-sm:p-4"
    >
      <input type="hidden" name="demandId" value={demandId} />

      <FormError
        message={state?.ok === false && !state.fields ? state.error : undefined}
      />

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <TextField
          label="Valor da proposta"
          name="price"
          required
          inputMode="decimal"
          placeholder="9.400"
          hint="Em reais, valor total do projeto"
          error={fieldError('priceCents')}
        />
        <TextField
          label="Prazo de entrega"
          name="deliveryWeeks"
          type="number"
          required
          min={1}
          max={104}
          defaultValue={4}
          hint="Em semanas"
          error={fieldError('deliveryWeeks')}
        />
      </div>

      <TextArea
        label="Sua abordagem"
        name="approach"
        required
        rows={5}
        minLength={40}
        maxLength={5000}
        placeholder="Como você pretende resolver? Que ferramentas usaria e por quê?"
        hint="Explique o raciocínio, não só a lista de tarefas."
        error={fieldError('approach')}
      />

      <TextArea
        label="O que será entregue"
        name="deliverables"
        rows={4}
        placeholder={'Agente publicado em produção\nIntegração com o CRM\nDocumentação de operação\n2 semanas de acompanhamento'}
        hint="Um item por linha."
        error={fieldError('deliverables')}
      />

      <TextArea
        label="Observações (opcional)"
        name="notes"
        rows={3}
        maxLength={2000}
        placeholder="Condições, premissas ou o que precisaria ser confirmado antes de começar."
        error={fieldError('notes')}
      />

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar proposta'}
        </Button>
      </div>
    </form>
  );
}
