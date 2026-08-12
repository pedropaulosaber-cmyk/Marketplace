import Link from 'next/link';
import { Rating, Tag, Thumb } from '@/components/ui/primitives';
import { FavoriteButton } from './favorite-button';
import { formatPrice } from '@/lib/money';
import { cn } from '@/lib/cn';

/**
 * Product card — the `.pc` component from the Canvas design.
 *
 * The whole card is one link (a stretched overlay) so the entire surface is
 * clickable while the accessibility tree still sees a single, well-named link.
 * The favourite button sits above that overlay so it stays independently
 * operable.
 */

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
  ratingSum: number;
  ratingCount: number;
  category: { name: string };
  author: { name: string };
}

export function ProductCard({
  product,
  favorited,
  showFavorite = true,
  className,
}: {
  product: ProductCardData;
  favorited?: boolean;
  showFavorite?: boolean;
  className?: string;
}) {
  const average =
    product.ratingCount > 0 ? product.ratingSum / product.ratingCount : null;

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-[10px] rounded-[14px] border border-line bg-white p-4',
        'transition-[transform,box-shadow,border-color] duration-150',
        'hover:-translate-y-[3px] hover:border-blue hover:shadow-[0_12px_28px_rgb(15_23_42/0.10)]',
        'focus-within:border-blue max-sm:rounded-[16px]',
        className
      )}
    >
      <Thumb className="h-[110px] w-full" />

      <div className="flex items-start justify-between gap-2">
        <Tag>{product.category.name}</Tag>
        {showFavorite ? (
          <FavoriteButton
            productId={product.id}
            initial={favorited ?? false}
            label={product.name}
            className="relative z-10"
          />
        ) : null}
      </div>

      <h3 className="text-[14.5px] leading-snug font-bold">
        {/* Stretched link: covers the card without nesting interactive elements. */}
        <Link
          href={`/products/${product.slug}`}
          className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink"
        >
          {product.name}
        </Link>
      </h3>

      <p className="line-clamp-2 flex-1 text-[12.5px] leading-[1.5] text-muted">
        {product.tagline}
      </p>

      <p className="text-[11.5px] text-muted">por {product.author.name}</p>

      <div className="flex items-center justify-between border-t border-line pt-[10px]">
        <Rating value={average} count={product.ratingCount} />
        <span className="text-[15px] font-extrabold">
          {formatPrice(product.priceCents)}
        </span>
      </div>
    </article>
  );
}

/** Compact variant used in horizontal scrollers and related-product rows. */
export function ProductCardCompact({
  product,
}: {
  product: ProductCardData;
}) {
  const average =
    product.ratingCount > 0 ? product.ratingSum / product.ratingCount : null;

  return (
    <article className="group relative flex w-[200px] flex-none flex-col gap-2 rounded-[14px] border border-line bg-white p-3 transition-colors hover:border-blue">
      <Thumb className="h-[78px] w-full" />
      <Tag className="self-start text-[10.5px]">{product.category.name}</Tag>
      <h3 className="text-[13.5px] font-bold">
        <Link
          href={`/products/${product.slug}`}
          className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink"
        >
          {product.name}
        </Link>
      </h3>
      <div className="flex items-center justify-between border-t border-line pt-2">
        <Rating value={average} count={product.ratingCount} className="text-[11px]" />
        <span className="text-[14px] font-extrabold">
          {formatPrice(product.priceCents)}
        </span>
      </div>
    </article>
  );
}
