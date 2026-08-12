'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Product screenshot gallery.
 *
 * Images are creator-uploaded and may legitimately be missing — the bucket
 * key can outlive the object, and the seed catalogue ships keys with no bytes
 * behind them at all. Rather than leaving a broken-image icon in the middle of
 * the page, a failed load falls back to the same styled placeholder used
 * elsewhere in the catalogue, so the layout is correct whether or not the
 * bytes exist. Real uploads drop in without any change here.
 */

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
}

export function ProductGallery({
  images,
  className,
}: {
  images: GalleryImage[];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  if (images.length === 0) return null;

  const current = images[Math.min(active, images.length - 1)];
  if (!current) return null;

  function markFailed(id: string) {
    setFailed((previous) => {
      if (previous.has(id)) return previous;
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <figure className="m-0">
        <div className="relative overflow-hidden rounded-[14px] border border-line bg-bg">
          {failed.has(current.id) ? (
            <span
              aria-hidden="true"
              className="thumb block h-[320px] w-full rounded-none max-sm:h-[190px]"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={current.src}
              alt={current.alt}
              width={1280}
              height={720}
              onError={() => markFailed(current.id)}
              className="block h-[320px] w-full object-cover max-sm:h-[190px]"
            />
          )}
        </div>
        <figcaption className="mt-2 text-[12.5px] text-muted">
          {current.alt}
        </figcaption>
      </figure>

      {images.length > 1 ? (
        <ul className="flex flex-wrap gap-2" role="list">
          {images.map((image, index) => {
            const selected = index === active;

            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`Ver imagem ${index + 1} de ${images.length}: ${image.alt}`}
                  className={cn(
                    'block overflow-hidden rounded-[10px] border transition-colors',
                    selected
                      ? 'border-blue ring-1 ring-blue'
                      : 'border-line hover:border-blue'
                  )}
                >
                  {failed.has(image.id) ? (
                    <span
                      aria-hidden="true"
                      className="thumb block h-[54px] w-[86px] rounded-none"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={image.src}
                      alt=""
                      width={172}
                      height={108}
                      onError={() => markFailed(image.id)}
                      className="block h-[54px] w-[86px] object-cover"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
