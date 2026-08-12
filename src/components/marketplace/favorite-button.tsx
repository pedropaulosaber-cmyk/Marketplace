'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFavoriteAction } from '@/server/actions/marketplace-actions';
import { cn } from '@/lib/cn';

/**
 * Favourite toggle.
 *
 * Optimistic: the heart fills immediately, then reconciles with the server's
 * answer. On failure it reverts and, when the reason is that nobody is signed
 * in, sends the user to login rather than silently doing nothing.
 */
export function FavoriteButton({
  productId,
  professionalId,
  initial,
  label,
  className,
}: {
  productId?: string;
  professionalId?: string;
  initial: boolean;
  label: string;
  className?: string;
}) {
  const [favorited, setFavorited] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !favorited;
    setFavorited(next); // optimistic

    startTransition(async () => {
      const result = await toggleFavoriteAction({ productId, professionalId });

      if (!result.ok) {
        setFavorited(!next); // revert

        // A guest hitting "save" wants to save — take them to sign in.
        if (result.error.includes('entrar')) {
          router.push('/login?next=' + encodeURIComponent(window.location.pathname));
        }
        return;
      }

      setFavorited(result.data.favorited);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={
        favorited ? `Remover ${label} dos favoritos` : `Salvar ${label} nos favoritos`
      }
      className={cn(
        'grid h-8 w-8 flex-none place-items-center rounded-full border border-line bg-white transition-colors',
        'hover:border-blue disabled:opacity-60 max-sm:h-10 max-sm:w-10',
        favorited ? 'text-blue' : 'text-muted hover:text-blue-700',
        className
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z" />
      </svg>
    </button>
  );
}
