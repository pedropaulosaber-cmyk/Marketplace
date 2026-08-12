'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  FormError,
  SelectField,
  TextArea,
  TextField,
} from '@/components/ui/field';
import { createDemandAction } from '@/server/actions/marketplace-actions';
import type { ActionResult } from '@/server/actions/action-result';

/**
 * Demand publishing form.
 *
 * Grouped into three steps' worth of questions on one page: the problem, the
 * context, and the constraints. A single scrollable form beats a wizard here —
 * the buyer can see everything they are being asked before committing.
 */

const CATEGORIES = [
  'Atendimento',
  'Vendas e CRM',
  'Marketing',
  'Financeiro',
  'Operações',
  'RH',
  'Dados e documentos',
  'Outro',
] as const;

const TOOLS = [
  'WhatsApp',
  'n8n',
  'Make',
  'HubSpot',
  'Google Calendar',
  'Shopify',
  'Slack',
  'Notion',
  'Stripe',
  'OpenAI',
] as const;

export function DemandForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(createDemandAction, null);

  // Navigate on success rather than redirecting inside the action, so the
  // form keeps its state if the submission fails. `refresh` first, so the
  // destination is fetched from the server rather than any cached copy.
  useEffect(() => {
    if (!state?.ok) return;

    router.refresh();
    router.push(`/demands/${state.data.id}`);
  }, [state, router]);

  const fieldError = (name: string) =>
    state?.ok === false ? state.fields?.[name] : undefined;

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-6">
      <FormError
        message={
          state?.ok === false && !state.fields ? state.error : undefined
        }
      />

      <TextField
        label="Título da demanda"
        name="title"
        required
        minLength={10}
        maxLength={140}
        placeholder="Ex.: Automação de atendimento + CRM + WhatsApp"
        hint="Resuma o problema em uma linha."
        error={fieldError('title')}
      />

      <SelectField
        label="Categoria"
        name="category"
        required
        error={fieldError('category')}
      >
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </SelectField>

      <TextArea
        label="Qual é o problema?"
        name="problem"
        required
        rows={4}
        minLength={30}
        maxLength={4000}
        placeholder="Descreva a situação atual e o que não está funcionando."
        error={fieldError('problem')}
      />

      <TextArea
        label="Qual é o objetivo?"
        name="goal"
        required
        rows={3}
        minLength={15}
        maxLength={2000}
        placeholder="Que resultado mensurável você espera? Ex.: reduzir o tempo de resposta de 4 horas para 2 minutos."
        hint="Um objetivo mensurável ajuda o profissional a dimensionar o escopo."
        error={fieldError('goal')}
      />

      <TextArea
        label="Detalhes e contexto"
        name="details"
        required
        rows={6}
        minLength={30}
        maxLength={8000}
        placeholder="Como funciona hoje, quantas pessoas envolvidas, volume, sistemas em uso, restrições."
        error={fieldError('details')}
      />

      <fieldset className="border-0 p-0">
        <legend className="text-[12.5px] font-bold text-[#334155]">
          Ferramentas envolvidas
        </legend>
        <p className="mt-1 text-[12.5px] text-muted">
          Marque as que já são usadas na sua operação.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOOLS.map((tool) => (
            <label
              key={tool}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-[14px] py-[9px] text-[13px] font-medium has-checked:border-blue has-checked:bg-sky has-checked:text-blue-700"
            >
              <input
                type="checkbox"
                name="tools"
                value={tool}
                className="h-[14px] w-[14px] accent-blue"
              />
              {tool}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <TextField
          label="Orçamento mínimo"
          name="budgetMin"
          required
          inputMode="decimal"
          placeholder="6.000"
          hint="Em reais"
          error={fieldError('budgetMinCents')}
        />
        <TextField
          label="Orçamento máximo"
          name="budgetMax"
          required
          inputMode="decimal"
          placeholder="12.000"
          hint="Em reais"
          error={fieldError('budgetMaxCents')}
        />
        <TextField
          label="Prazo"
          name="deadlineWeeks"
          type="number"
          required
          min={1}
          max={104}
          defaultValue={6}
          hint="Em semanas"
          error={fieldError('deadlineWeeks')}
        />
      </div>

      <div className="flex items-center gap-4 border-t border-line pt-6 max-sm:flex-col max-sm:items-stretch">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Publicando…' : 'Publicar demanda'}
        </Button>
        <p className="text-[13px] leading-[1.5] text-muted">
          Sua demanda fica visível para profissionais verificados. Você escolhe
          qual proposta aceitar.
        </p>
      </div>
    </form>
  );
}
