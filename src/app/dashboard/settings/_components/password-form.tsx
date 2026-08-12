'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { changePasswordAction } from '@/server/actions/auth-actions';
import type { ActionResult } from '@/server/actions/action-result';

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(changePasswordAction, null);

  const fieldError = (name: string) =>
    state?.ok === false ? state.fields?.[name] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError
        message={state?.ok === false && !state.fields ? state.error : undefined}
      />

      <TextField
        label="Senha atual"
        name="currentPassword"
        type="password"
        required
        autoComplete="current-password"
        error={fieldError('currentPassword')}
      />

      <TextField
        label="Nova senha"
        name="newPassword"
        type="password"
        required
        minLength={10}
        autoComplete="new-password"
        hint="Pelo menos 10 caracteres."
        error={fieldError('newPassword')}
      />

      <TextField
        label="Confirmar nova senha"
        name="confirmPassword"
        type="password"
        required
        autoComplete="new-password"
        error={fieldError('confirmPassword')}
      />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </div>
    </form>
  );
}
