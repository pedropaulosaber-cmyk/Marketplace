'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  FormError,
  FormSuccess,
  TextArea,
  TextField,
} from '@/components/ui/field';
import { updateProfileAction } from '@/server/actions/auth-actions';
import type { ActionResult } from '@/server/actions/action-result';

export function ProfileForm({
  defaults,
}: {
  defaults: {
    name: string;
    headline: string;
    bio: string;
    company: string;
    website: string;
    location: string;
  };
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(updateProfileAction, null);

  const fieldError = (name: string) =>
    state?.ok === false ? state.fields?.[name] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state?.ok ? <FormSuccess message="Perfil atualizado." /> : null}
      <FormError
        message={state?.ok === false && !state.fields ? state.error : undefined}
      />

      <TextField
        label="Nome"
        name="name"
        required
        defaultValue={defaults.name}
        autoComplete="name"
        error={fieldError('name')}
      />

      <TextField
        label="Título"
        name="headline"
        defaultValue={defaults.headline}
        placeholder="Ex.: Especialista em automação comercial"
        hint="Aparece junto ao seu nome nas avaliações e no perfil."
        error={fieldError('headline')}
      />

      <TextArea
        label="Bio"
        name="bio"
        rows={5}
        defaultValue={defaults.bio}
        maxLength={2000}
        placeholder="Conte o que você faz e para quem."
        error={fieldError('bio')}
      />

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <TextField
          label="Empresa"
          name="company"
          defaultValue={defaults.company}
          autoComplete="organization"
          error={fieldError('company')}
        />
        <TextField
          label="Localização"
          name="location"
          defaultValue={defaults.location}
          placeholder="São Paulo, BR"
          error={fieldError('location')}
        />
      </div>

      <TextField
        label="Site"
        name="website"
        type="url"
        defaultValue={defaults.website}
        placeholder="https://…"
        autoComplete="url"
        error={fieldError('website')}
      />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}
