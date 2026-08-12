'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { loginAction } from '@/server/actions/auth-actions';
import type { ActionResult } from '@/server/actions/action-result';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(loginAction, null);

  const fieldError = (name: string) =>
    state?.ok === false ? state.fields?.[name] : undefined;

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      {/* Validated server-side against open-redirect abuse before use. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormError
        message={state?.ok === false && !state.fields ? state.error : undefined}
      />

      <TextField
        label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="voce@empresa.com.br"
        error={fieldError('email')}
      />

      <TextField
        label="Senha"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="Sua senha"
        error={fieldError('password')}
      />

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
