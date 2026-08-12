'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, LinkButton } from '@/components/ui/button';
import { joinAffiliateProgramAction } from '@/server/actions/affiliate-actions';

/**
 * Invitation to promote this product.
 *
 * Shown to everyone, including signed-out visitors: the offer itself is the
 * recruiting pitch, and hiding it behind a login means nobody discovers the
 * programme exists. Only the join action requires an account.
 */
export function AffiliateCta({
  productId,
  productSlug,
  commissionPercent,
  perSaleLabel,
  cookieDays,
  autoApprove,
  terms,
  signedIn,
  isOwner,
}: {
  productId: string;
  productSlug: string;
  commissionPercent: string;
  perSaleLabel: string;
  cookieDays: number;
  autoApprove: boolean;
  terms: string | null;
  signedIn: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [joined, setJoined] = useState<{ code: string; status: string }>();

  // A creator cannot be their own affiliate, so pitching it to them is noise.
  if (isOwner) return null;

  function join() {
    setError(undefined);

    startTransition(async () => {
      const result = await joinAffiliateProgramAction({ productId });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setJoined(result.data);
      router.refresh();
    });
  }

  return (
    <section className="mt-16 rounded-[16px] border border-line bg-bg p-7 max-sm:mt-10 max-sm:p-5">
      <p className="text-[11.5px] font-extrabold tracking-[0.12em] text-blue-700 uppercase">
        Programa de afiliados
      </p>

      <h2 className="mt-2 text-[24px] leading-tight font-extrabold max-sm:text-[20px]">
        Ganhe {commissionPercent}% indicando este produto
      </h2>

      <p className="mt-2 max-w-[62ch] text-[14.5px] leading-[1.6] text-muted">
        Você recebe <strong className="text-ink">{perSaleLabel}</strong> por
        venda feita através do seu link. O clique continua valendo por{' '}
        {cookieDays} {cookieDays === 1 ? 'dia' : 'dias'}, e a comissão é
        liberada depois do prazo de reembolso.
      </p>

      {terms ? (
        <div className="mt-4 rounded-[10px] border border-line bg-white p-4">
          <p className="text-[12.5px] font-bold">Regras do criador</p>
          <p className="mt-1 text-[13.5px] leading-[1.6] text-muted">{terms}</p>
        </div>
      ) : null}

      <div className="mt-5">
        {joined ? (
          <div className="rounded-[10px] border border-line bg-white p-4">
            <p className="text-[14px] font-bold">
              {joined.status === 'APPROVED'
                ? 'Tudo certo — você já pode divulgar.'
                : 'Pedido enviado. O criador precisa aprovar.'}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Seu link e seus resultados ficam em{' '}
              <a href="/dashboard/affiliate" className="text-blue-700">
                Produtos que promovo
              </a>
              .
            </p>
          </div>
        ) : signedIn ? (
          <div className="flex flex-col gap-2">
            <div>
              <Button onClick={join} disabled={pending}>
                {pending ? 'Gerando seu link…' : 'Quero promover'}
              </Button>
            </div>
            <p className="text-[12.5px] text-muted">
              {autoApprove
                ? 'Seu link é gerado na hora.'
                : 'O criador revisa cada pedido antes de liberar o link.'}
            </p>
            {error ? (
              <span role="alert" className="text-[12.5px] font-medium text-danger-fg">
                {error}
              </span>
            ) : null}
          </div>
        ) : (
          <LinkButton
            href={`/login?next=${encodeURIComponent(`/products/${productSlug}`)}`}
          >
            Entrar para promover
          </LinkButton>
        )}
      </div>
    </section>
  );
}
