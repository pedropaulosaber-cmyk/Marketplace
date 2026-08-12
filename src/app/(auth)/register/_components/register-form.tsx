'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxField, FormError, TextField } from '@/components/ui/field';
import { registerAction } from '@/server/actions/auth-actions';
import type { ActionResult } from '@/server/actions/action-result';
import { cn } from '@/lib/cn';

/**
 * Registration.
 *
 * The intent picker only decides which starting role the *server* assigns from
 * a closed set — the form cannot name a role directly, so ADMIN is
 * unreachable from here by construction.
 */

const INTENTS = [
  {
    id: 'buy',
    label: 'Quero comprar',
    sub: 'Empresas e profissionais que precisam de uma solução',
  },
  {
    id: 'sell',
    label: 'Quero vender',
    sub: 'Criadores e especialistas que publicam soluções',
  },
  {
    id: 'work',
    label: 'Quero ser contratado',
    sub: 'Profissionais que respondem a demandas',
  },
] as const;

export function RegisterForm({
  defaultIntent,
}: {
  defaultIntent: 'buy' | 'sell' | 'work';
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(registerAction, null);

  const [intent, setIntent] = useState<'buy' | 'sell' | 'work'>(defaultIntent);

  const fieldError = (name: string) =>
    state?.ok === false ? state.fields?.[name] : undefined;

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="intent" value={intent} />

      <FormError
        message={state?.ok === false && !state.fields ? state.error : undefined}
      />

      <fieldset className="border-0 p-0">
        <legend className="sr-only">Como você quer usar a plataforma</legend>
        <div className="flex flex-col gap-2">
          {INTENTS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={intent === option.id}
              onClick={() => setIntent(option.id)}
              className={cn(
                'cursor-pointer rounded-[12px] border px-[18px] py-[14px] text-left transition-colors',
                intent === option.id
                  ? 'border-blue bg-sky'
                  : 'border-line bg-white hover:border-blue/50'
              )}
            >
              <span
                className={cn(
                  'block text-[15px] font-extrabold tracking-[-0.02em]',
                  intent === option.id ? 'text-blue-700' : 'text-ink'
                )}
              >
                {option.label}
              </span>
              <span className="mt-[2px] block text-[12.5px] text-muted">
                {option.sub}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <TextField
        label="Nome"
        name="name"
        required
        autoComplete="name"
        placeholder="Como devemos chamar você"
        error={fieldError('name')}
      />

      <TextField
        label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="voce@empresa.com.br"
        error={fieldError('email')}
      />

      <TextField
        label="Senha"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        minLength={10}
        hint="Pelo menos 10 caracteres. Uma frase longa é mais segura que símbolos."
        error={fieldError('password')}
      />

      <TextField
        label="Confirmar senha"
        name="confirmPassword"
        type="password"
        required
        autoComplete="new-password"
        error={fieldError('confirmPassword')}
      />

      <CheckboxField
        name="acceptTerms"
        required
        label="Li e aceito os termos de uso e a política de privacidade."
        error={fieldError('acceptTerms')}
      />

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </form>
  );
}
