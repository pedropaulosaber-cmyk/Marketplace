import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, StatusTag } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { getOwnOrder } from '@/server/services/order-service';
import { isAppError } from '@/lib/errors';
import { isPaymentsConfigured } from '@/lib/env';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Finalizar compra',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

const STEPS = ['Resumo', 'Pagamento', 'Pronto'] as const;

/**
 * Checkout.
 *
 * The order already exists — it was created server-side when the buyer clicked
 * buy, with prices read from the catalog. This page confirms the amount and
 * hands off to the payment provider.
 *
 * It never marks anything paid. Fulfilment happens only in the webhook, after
 * the provider's signature is verified.
 */
export default async function CheckoutPage({ params }: PageProps) {
  const { orderId } = await params;

  let order: Awaited<ReturnType<typeof getOwnOrder>>;
  try {
    // Scoped to the signed-in buyer inside the service — another user's order
    // id resolves to "not found", not to someone else's checkout.
    order = await getOwnOrder(orderId);
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const isPaid = order.status === 'PAID';
  const currentStep = isPaid ? 3 : 2;

  return (
    <Container className="py-14 max-sm:py-8">
      <div className="mx-auto max-w-[640px]">
        <ol className="flex items-center gap-6" aria-label="Etapas da compra">
          {STEPS.map((label, index) => {
            const step = index + 1;
            const reached = currentStep >= step;

            return (
              <li
                key={label}
                aria-current={currentStep === step ? 'step' : undefined}
                className="flex items-center gap-2 text-[12.5px] font-bold"
                style={{ opacity: reached ? 1 : 0.4 }}
              >
                <span
                  className={
                    reached
                      ? 'grid h-[22px] w-[22px] place-items-center rounded-full bg-blue text-[11px] text-white'
                      : 'grid h-[22px] w-[22px] place-items-center rounded-full bg-line text-[11px] text-muted'
                  }
                >
                  {step}
                </span>
                {label}
              </li>
            );
          })}
        </ol>

        <h1 className="mt-8 text-[32px] leading-tight font-extrabold max-sm:text-[24px]">
          {isPaid ? 'Compra confirmada' : 'Finalizar compra'}
        </h1>

        <div className="mt-8 rounded-[14px] border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">
              Pedido {order.number}
            </p>
            <StatusTag status={order.status} />
          </div>

          <ul className="mt-5 flex flex-col gap-4">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 border-b border-line pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-[15px] font-bold">{item.productName}</p>
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="text-[12.5px] no-underline"
                  >
                    Ver detalhes do produto
                  </Link>
                </div>
                <span className="text-[15px] font-extrabold">
                  {formatMoney(item.unitCents)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-5 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatMoney(order.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between text-[18px] font-extrabold">
              <dt>Total</dt>
              <dd>{formatMoney(order.totalCents)}</dd>
            </div>
          </dl>
        </div>

        {isPaid ? (
          <div className="mt-8 rounded-[14px] border border-ok-fg/25 bg-ok-bg p-6">
            <p className="text-[16px] font-bold text-ok-fg">
              Pagamento confirmado
            </p>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#065f46]">
              Seus arquivos já estão liberados na biblioteca. Você também recebe
              as atualizações publicadas pelo criador.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton href="/library">Ir para a biblioteca</LinkButton>
              <LinkButton href="/products" variant="secondary">
                Continuar explorando
              </LinkButton>
            </div>
          </div>
        ) : !isPaymentsConfigured ? (
          // Honest failure: without a provider we cannot take money, and we
          // will not pretend otherwise.
          <div className="mt-8 rounded-[14px] border border-warn-fg/25 bg-warn-bg p-6">
            <p className="text-[16px] font-bold text-warn-fg">
              Pagamentos indisponíveis neste ambiente
            </p>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#78350f]">
              O provedor de pagamento não está configurado. Este pedido ficará
              como pendente até que a integração seja habilitada — nenhuma
              cobrança foi feita.
            </p>
            <div className="mt-5">
              <LinkButton href="/products" variant="secondary">
                Voltar ao catálogo
              </LinkButton>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-[14px] border border-line bg-bg p-6">
            <p className="text-[16px] font-bold">Pagamento</p>
            <p className="mt-2 text-[14px] leading-[1.6] text-muted">
              Você será direcionado ao ambiente seguro do provedor para concluir
              o pagamento. A liberação do produto acontece automaticamente assim
              que a confirmação chegar.
            </p>
            <p className="mt-4 text-[12.5px] leading-[1.5] text-muted">
              Reembolso integral em até 14 dias. Seus dados de cartão nunca
              passam pelos servidores da Automatize.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton href={`/orders`}>Acompanhar pedido</LinkButton>
              <LinkButton href="/products" variant="secondary">
                Voltar ao catálogo
              </LinkButton>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
