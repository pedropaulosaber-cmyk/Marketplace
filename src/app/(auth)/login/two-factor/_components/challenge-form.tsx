'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { completeChallengeAction } from '@/server/actions/two-factor-actions';

/**
 * Second step of login: the code from the authenticator, or a recovery code.
 *
 * One field accepts both. Splitting them would force someone who has lost
 * their phone — already the worst moment to meet a confusing form — to first
 * work out which box they are supposed to be in.
 */
export function ChallengeForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [code, setCode] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    startTransition(async () => {
      const result = await completeChallengeAction({ code });

      if (!result.ok) {
        setError(result.error);
        setCode('');
        return;
      }

      // The session cookie is set by the action; a full navigation makes the
      // server pick it up rather than reusing the unauthenticated render.
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      <TextField
        name="code"
        label="Código de verificação"
        // `one-time-code` is what lets a phone offer the code from the
        // keyboard rather than making people switch apps and memorise it.
        autoComplete="one-time-code"
        inputMode="numeric"
        autoFocus
        required
        maxLength={20}
        value={code}
        onChange={(event) => setCode(event.currentTarget.value)}
        hint="Abra seu app autenticador, ou use um dos códigos de recuperação."
      />

      <FormError message={error} />

      <Button type="submit" size="lg" fullWidth disabled={pending || code.length < 6}>
        {pending ? 'Verificando…' : 'Entrar'}
      </Button>
    </form>
  );
}
