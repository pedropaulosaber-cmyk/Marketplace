'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  CheckboxField,
  FormError,
  SelectField,
  TextArea,
  TextField,
} from '@/components/ui/field';
import { createProductAction } from '@/server/actions/marketplace-actions';
import type { ActionResult } from '@/server/actions/action-result';

/**
 * Product publishing form.
 *
 * List fields are plain textareas, one item per line — faster to fill than a
 * repeater widget and lossless to paste into. The server splits and validates
 * each line.
 *
 * Price is typed in reais and converted to integer cents server-side; the
 * browser never decides what a product costs.
 */
export function ProductForm({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionResult<{ slug: string }> | null,
    FormData
  >(createProductAction, null);

  useEffect(() => {
    if (!state?.ok) return;

    // `revalidatePath` in the action invalidates the server cache, but the
    // client Router Cache can still hold a copy of the destination from an
    // earlier visit. Refreshing discards it so the creator lands on a list
    // that actually contains the product they just made.
    router.refresh();
    router.push('/dashboard/products');
  }, [state, router]);

  const fieldError = (name: string) =>
    state?.ok === false ? state.fields?.[name] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormError
        message={state?.ok === false && !state.fields ? state.error : undefined}
      />

      <TextField
        label="Nome do produto"
        name="name"
        required
        minLength={4}
        maxLength={120}
        placeholder="Ex.: AI Sales Agent"
        error={fieldError('name')}
      />

      <TextField
        label="Descrição curta"
        name="tagline"
        required
        minLength={10}
        maxLength={180}
        placeholder="Uma linha sobre o que o produto resolve."
        hint="É o que aparece nos cards e nos resultados de busca."
        error={fieldError('tagline')}
      />

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <SelectField
          label="Categoria"
          name="categoryId"
          required
          error={fieldError('categoryId')}
        >
          <option value="">Selecione…</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Preço"
          name="price"
          required
          inputMode="decimal"
          placeholder="149,00"
          hint="Em reais. Use 0 para publicar gratuitamente."
          error={fieldError('priceCents')}
        />
      </div>

      <TextArea
        label="Descrição completa"
        name="descriptionMd"
        required
        rows={10}
        minLength={40}
        maxLength={20000}
        placeholder="O que o produto faz, para quem é, como funciona por dentro e o que o comprador precisa saber antes de instalar."
        hint="Aceita Markdown."
        error={fieldError('descriptionMd')}
      />

      <TextField
        label="Vídeo de demonstração (opcional)"
        name="videoUrl"
        type="url"
        placeholder="https://…"
        error={fieldError('videoUrl')}
      />

      <TextField
        label="Tags"
        name="tags"
        placeholder="Vendas, CRM, n8n"
        hint="Separadas por vírgula. Até 8."
        error={fieldError('tags')}
      />

      <TextArea
        label="Benefícios"
        name="benefits"
        rows={4}
        placeholder={'Responde no seu tom, com as regras que você define.\nRegistra cada interação para auditoria.'}
        hint="Um por linha."
        error={fieldError('benefits')}
      />

      <TextArea
        label="O que está incluído"
        name="included"
        rows={4}
        placeholder={'Fluxo completo pronto para importar\nDocumentação de instalação\n90 dias de suporte'}
        hint="Um por linha."
        error={fieldError('included')}
      />

      <TextArea
        label="Requisitos"
        name="requirements"
        rows={3}
        placeholder={'Conta ativa nas integrações listadas\nAcesso de administrador para conectar as APIs'}
        hint="Um por linha."
        error={fieldError('requirements')}
      />

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <TextArea
          label="Integrações"
          name="integrations"
          rows={3}
          placeholder={'HubSpot\nWhatsApp\nn8n'}
          hint="Uma por linha."
          error={fieldError('integrations')}
        />
        <TextArea
          label="Compatibilidade"
          name="compat"
          rows={3}
          placeholder={'Web\nAPI REST\nWebhook'}
          hint="Uma por linha."
          error={fieldError('compat')}
        />
      </div>

      <div className="rounded-[12px] border border-line bg-bg p-5">
        <CheckboxField
          name="submit"
          label={
            <>
              <strong>Enviar para revisão agora.</strong> Sem marcar, o produto
              fica salvo como rascunho e você pode publicar depois.
            </>
          }
        />
        <p className="mt-3 text-[12.5px] leading-[1.5] text-muted">
          Produtos pagos precisam de ao menos um arquivo entregável antes de ir
          para revisão.
        </p>
      </div>

      <div className="flex items-center gap-4 border-t border-line pt-6 max-sm:flex-col max-sm:items-stretch">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar produto'}
        </Button>
        <p className="text-[13px] text-muted">
          Você pode editar tudo depois, inclusive o preço.
        </p>
      </div>
    </form>
  );
}
