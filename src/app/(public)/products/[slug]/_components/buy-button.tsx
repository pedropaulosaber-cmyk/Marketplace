'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/field';
import { startCheckoutAction } from '@/server/actions/marketplace-actions';

/**
 * Purchase CTA.
 *
 * Sends only the product id — the server reads the price from the catalog.
 * A free product settles server-side immediately and goes straight to the
 * library; a paid one hands off to the checkout page with the order it created.
 */
export function BuyButton({
  productId,
  isFree,
  signedIn,
  slug,
}: {
  productId: string;
  isFree: boolean;
  signedIn: boolean;
  slug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function buy() {
    // Send a guest to sign in and bring them straight back here afterwards.
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/products/${slug}`)}`);
      return;
    }

    setError(undefined);

    startTransition(async () => {
      const result = await startCheckoutAction(productId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.data.status === 'paid') {
        router.push(`/library?welcome=${result.data.orderNumber}`);
        return;
      }

      router.push(`/checkout/${result.data.orderId}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" fullWidth onClick={buy} disabled={pending}>
        {pending
          ? 'Processando…'
          : isFree
            ? 'Instalar grátis'
            : 'Comprar agora'}
      </Button>
      <FormError message={error} />
    </div>
  );
}
