'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  CheckboxField,
  FormError,
  FormSuccess,
  TextArea,
  TextField,
} from '@/components/ui/field';
import { saveAffiliateProgramAction } from '@/server/actions/affiliate-actions';
import { formatPrice } from '@/lib/money';

/**
 * Commission settings for one product.
 *
 * The live "you keep / they earn" split is the point of this form: a creator
 * setting a rate is really deciding what they take home, and making them do
 * that arithmetic in their head is how rates get set badly and then resented.
 */
export function ProgramForm({
  productId,
  priceCents,
  platformFeeBps,
  initial,
}: {
  productId: string;
  priceCents: number;
  platformFeeBps: number;
  initial: {
    enabled: boolean;
    commissionPercent: number;
    cookieDays: number;
    autoApprove: boolean;
    terms: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(initial.enabled);
  const [commission, setCommission] = useState(String(initial.commissionPercent));
  const [cookieDays, setCookieDays] = useState(String(initial.cookieDays));
  const [autoApprove, setAutoApprove] = useState(initial.autoApprove);
  const [terms, setTerms] = useState(initial.terms);

  const percent = Number(commission);
  const valid = Number.isFinite(percent) && percent >= 1 && percent <= 80;

  const platformCents = Math.round((priceCents * platformFeeBps) / 10_000);
  const affiliateCents = valid
    ? Math.floor((priceCents * Math.round(percent * 100)) / 10_000)
    : 0;
  const sellerCents = priceCents - platformCents - affiliateCents;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSaved(false);

    startTransition(async () => {
      const result = await saveAffiliateProgramAction({
        productId,
        enabled,
        commissionPercent: commission,
        cookieDays,
        autoApprove,
        terms,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <CheckboxField
        name="enabled"
        label={
          <span>
            <span className="block font-bold">
              Aceitar afiliados para este produto
            </span>
            <span className="block text-[12.5px] text-muted">
              Enquanto estiver desligado, ninguém novo consegue se afiliar e
              nenhum clique novo é atribuído.
            </span>
          </span>
        }
        checked={enabled}
        onChange={(event) => setEnabled(event.currentTarget.checked)}
      />

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <TextField
          name="commissionPercent"
          label="Comissão (%)"
          type="number"
          min={1}
          max={80}
          step={1}
          value={commission}
          onChange={(event) => setCommission(event.currentTarget.value)}
          hint="Sai da sua parte, não da taxa da plataforma."
        />
        <TextField
          name="cookieDays"
          label="Janela de atribuição (dias)"
          type="number"
          min={1}
          max={365}
          step={1}
          value={cookieDays}
          onChange={(event) => setCookieDays(event.currentTarget.value)}
          hint="Por quanto tempo um clique continua valendo comissão."
        />
      </div>

      {priceCents > 0 ? (
        <div className="rounded-[12px] border border-line bg-bg p-4">
          <p className="text-[12.5px] font-extrabold tracking-[0.1em] text-muted uppercase">
            Divisão de cada venda
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <dt className="text-[12.5px] text-muted">Você recebe</dt>
              <dd className="text-[18px] font-extrabold text-ink">
                {formatPrice(Math.max(sellerCents, 0))}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Afiliado recebe</dt>
              <dd className="text-[18px] font-extrabold text-blue-700">
                {formatPrice(affiliateCents)}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">
                Taxa da plataforma ({(platformFeeBps / 100).toFixed(0)}%)
              </dt>
              <dd className="text-[18px] font-extrabold text-muted">
                {formatPrice(platformCents)}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="rounded-[12px] border border-dashed border-line bg-bg px-4 py-3 text-[13px] text-muted">
          Este produto é gratuito, então não há comissão a pagar. O programa
          serve apenas para medir quem trouxe cada cadastro.
        </p>
      )}

      <CheckboxField
        name="autoApprove"
        label={
          <span>
            <span className="block font-bold">
              Aprovar novos afiliados automaticamente
            </span>
            <span className="block text-[12.5px] text-muted">
              Desligue se preferir revisar quem promove o seu produto antes de
              liberar o link.
            </span>
          </span>
        }
        checked={autoApprove}
        onChange={(event) => setAutoApprove(event.currentTarget.checked)}
      />

      <TextArea
        name="terms"
        label="Regras para afiliados (opcional)"
        rows={4}
        maxLength={2000}
        value={terms}
        onChange={(event) => setTerms(event.currentTarget.value)}
        hint="Ex.: proibido anunciar na marca, proibido prometer resultado garantido."
      />

      <FormError message={error} />
      <FormSuccess message={saved ? 'Programa atualizado.' : undefined} />

      <div>
        <Button type="submit" disabled={pending || !valid}>
          {pending ? 'Salvando…' : 'Salvar programa'}
        </Button>
      </div>
    </form>
  );
}
