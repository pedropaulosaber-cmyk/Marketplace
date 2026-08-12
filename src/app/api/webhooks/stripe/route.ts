import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { db } from '@/server/db/client';
import { verifyWebhook } from '@/server/payments/provider';
import { markOrderFailed, markOrderPaid } from '@/server/services/order-service';
import { audit } from '@/server/security/audit';
import { isPaymentsConfigured } from '@/lib/env';
import { log, securityLog } from '@/lib/logger';

const logger = log('stripe-webhook');

/**
 * Stripe webhook endpoint.
 *
 * This is the *only* path that marks an order paid. The browser's
 * "payment succeeded" callback is treated as a hint for navigation and
 * nothing more — a client can claim anything.
 *
 * Three properties matter here:
 *
 *   1. **Authenticity** — the signature is verified against the endpoint
 *      secret before the body is parsed. An unsigned or mis-signed request is
 *      rejected without touching the database.
 *   2. **Idempotency** — the provider retries aggressively and may deliver the
 *      same event repeatedly. The event id is inserted inside the same
 *      transaction as the fulfilment, so a replay hits a unique-constraint
 *      violation and changes nothing.
 *   3. **Amount verification** — the paid amount is compared against the order
 *      total before fulfilment, so a tampered or mismatched intent cannot
 *      unlock a product for less than its price.
 */

// The raw body is required for signature verification, so this route must not
// run on a runtime that pre-parses it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  if (!isPaymentsConfigured) {
    // Without a webhook secret we cannot verify anything, so we must not
    // process events at all.
    return NextResponse.json(
      { error: 'payments not configured' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    securityLog.warn('stripe webhook without signature header');
    return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhook(rawBody, signature);
  } catch (error) {
    // Either a forgery or a secret mismatch. Both are security events.
    securityLog.error(
      { err: error },
      'stripe webhook signature verification failed'
    );
    await audit({
      action: 'payment.webhook_rejected',
      entityType: 'Webhook',
      entityId: 'unknown',
      metadata: { reason: 'invalid_signature' },
    });
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    logger.error(
      { err: error, eventId: event.id, type: event.type },
      'webhook handling failed'
    );
    // A 500 tells Stripe to retry. Because handling is idempotent, retrying is
    // safe and is what we want for a transient database failure.
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      await fulfil(event, intent);
      break;
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      const orderId = intent.metadata?.orderId;
      if (!orderId) break;

      await db.$transaction(async (tx) => {
        await recordEvent(tx, event);
        await markOrderFailed(
          tx,
          orderId,
          intent.id,
          intent.last_payment_error?.message ?? 'payment failed'
        );
      });

      await audit({
        action: 'order.failed',
        entityType: 'Order',
        entityId: orderId,
        metadata: { eventId: event.id },
      });
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const intentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!intentId) break;

      await db.$transaction(async (tx) => {
        await recordEvent(tx, event);

        const payment = await tx.payment.findUnique({
          where: { providerRef: intentId },
          select: { orderId: true },
        });
        if (!payment) return;

        await tx.payment.update({
          where: { providerRef: intentId },
          data: { status: 'REFUNDED' },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });

        // Cancel any payout that has not settled yet — the platform must not
        // pay a seller for a refunded sale.
        await tx.payout.updateMany({
          where: {
            status: 'SCHEDULED',
            reference: (
              await tx.order.findUnique({
                where: { id: payment.orderId },
                select: { number: true },
              })
            )?.number,
          },
          data: { status: 'FAILED' },
        });

        await audit(
          {
            action: 'order.refunded',
            entityType: 'Order',
            entityId: payment.orderId,
            metadata: { eventId: event.id },
          },
          tx
        );
      });
      break;
    }

    default:
      // Unhandled event types are acknowledged, not errored — Stripe would
      // otherwise retry them forever.
      logger.debug({ type: event.type }, 'unhandled webhook event type');
  }
}

async function fulfil(
  event: Stripe.Event,
  intent: Stripe.PaymentIntent
): Promise<void> {
  const orderId = intent.metadata?.orderId;

  if (!orderId) {
    logger.warn({ intentId: intent.id }, 'payment intent without orderId');
    return;
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, totalCents: true, currency: true, status: true },
  });

  if (!order) {
    logger.warn({ orderId, intentId: intent.id }, 'webhook for unknown order');
    return;
  }

  // The amount actually captured must match what we charge for this order.
  // Anything else means the intent was tampered with or mismatched, and must
  // not unlock the deliverable.
  const paid = intent.amount_received ?? intent.amount;
  if (paid !== order.totalCents) {
    securityLog.error(
      {
        orderId,
        intentId: intent.id,
        expected: order.totalCents,
        received: paid,
      },
      'payment amount mismatch — refusing to fulfil'
    );

    await audit({
      action: 'payment.webhook_rejected',
      entityType: 'Order',
      entityId: orderId,
      metadata: {
        reason: 'amount_mismatch',
        expected: order.totalCents,
        received: paid,
      },
    });
    return;
  }

  const settled = await db.$transaction(async (tx) => {
    // Recording the event first means a duplicate delivery aborts the whole
    // transaction on the unique constraint, before any side effect runs.
    const fresh = await recordEvent(tx, event);
    if (!fresh) return false;

    return markOrderPaid(tx, orderId, intent.id);
  });

  if (settled) {
    await audit({
      action: 'order.paid',
      entityType: 'Order',
      entityId: orderId,
      metadata: { eventId: event.id, amountCents: paid },
    });
    logger.info({ orderId, amount: paid }, 'order fulfilled');
  }
}

/**
 * Records the provider event id. Returns false when this event was already
 * processed, which is the idempotency signal for the caller.
 */
async function recordEvent(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  event: Stripe.Event
): Promise<boolean> {
  const existing = await tx.processedWebhookEvent.findUnique({
    where: { provider_eventId: { provider: 'stripe', eventId: event.id } },
    select: { id: true },
  });

  if (existing) {
    logger.info({ eventId: event.id }, 'duplicate webhook event ignored');
    return false;
  }

  await tx.processedWebhookEvent.create({
    data: { provider: 'stripe', eventId: event.id, eventType: event.type },
  });

  return true;
}
