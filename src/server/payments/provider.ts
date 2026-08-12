import 'server-only';
import Stripe from 'stripe';
import { env, isPaymentsConfigured } from '@/lib/env';
import { unavailable } from '@/lib/errors';

/**
 * Payment provider integration (Stripe).
 *
 * The integration is structured for a real marketplace — a charge, a platform
 * fee, and a seller payout — and reads its credentials from the environment.
 *
 * When credentials are absent the provider reports itself unavailable and
 * checkout refuses to create an order. It never simulates a successful
 * payment: a fake "paid" order would hand out paid deliverables for free.
 */

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isPaymentsConfigured) {
    throw unavailable(
      'Pagamentos ainda não estão configurados neste ambiente. ' +
        'Defina STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET.'
    );
  }

  stripe ??= new Stripe(env.STRIPE_SECRET_KEY!, {
    // Pinned to the version this SDK is typed against. Bumping it is a
    // deliberate upgrade, never an implicit one.
    apiVersion: '2025-02-24.acacia',
    // Retries are safe because every mutating call carries an idempotency key.
    maxNetworkRetries: 2,
    timeout: 15_000,
    appInfo: { name: 'AUTOMATIZE', version: '0.1.0' },
  });

  return stripe;
}

export { isPaymentsConfigured };

export interface CreateIntentInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  buyerEmail: string;
  /** Platform commission withheld from the seller's transfer. */
  feeCents: number;
  /**
   * Seller's connected account id. When absent the funds settle to the
   * platform balance and are paid out through the internal Payout ledger.
   */
  sellerAccountId?: string | null;
}

/**
 * Creates a PaymentIntent for an order.
 *
 * `idempotencyKey` is the order id: retrying a failed request — whether from
 * our retry policy or an impatient user double-submitting — reuses the same
 * intent instead of charging twice.
 */
export async function createPaymentIntent(
  input: CreateIntentInput
): Promise<{ id: string; clientSecret: string }> {
  const client = getStripe();

  const intent = await client.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: input.buyerEmail,
      description: `AUTOMATIZE ${input.orderNumber}`,
      // Echoed back on the webhook so we can match the event to our order
      // without trusting anything the client sends.
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
      },
      ...(input.sellerAccountId
        ? {
            application_fee_amount: input.feeCents,
            transfer_data: { destination: input.sellerAccountId },
          }
        : {}),
    },
    { idempotencyKey: `order:${input.orderId}` }
  );

  if (!intent.client_secret) {
    throw unavailable('Não foi possível iniciar o pagamento.');
  }

  return { id: intent.id, clientSecret: intent.client_secret };
}

/**
 * Verifies a webhook signature and returns the parsed event.
 *
 * Throws on any failure. An unverified webhook is an attacker telling us an
 * order was paid — this check is the only thing standing between that and
 * free products.
 */
export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET!
  );
}

export async function refundPayment(
  providerRef: string,
  amountCents?: number
): Promise<void> {
  await getStripe().refunds.create(
    {
      payment_intent: providerRef,
      ...(amountCents ? { amount: amountCents } : {}),
    },
    { idempotencyKey: `refund:${providerRef}` }
  );
}
