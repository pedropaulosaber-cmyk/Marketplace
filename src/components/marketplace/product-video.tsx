'use client';

import { useState } from 'react';

/**
 * Demo video for a product.
 *
 * Nothing from the video host is contacted until the visitor actually clicks
 * play. That keeps a third-party frame (and its cookies) off every product
 * page view, keeps the embed out of the critical path, and means the
 * `frame-src` allowance in the CSP is only ever exercised on demand.
 *
 * The URL is re-validated here even though it is validated on write: this
 * component renders creator-supplied data, and an allowlist at the point of
 * use is what actually decides whether a frame is created.
 */

const ALLOWED_EMBED_HOSTS = new Set([
  'www.youtube-nocookie.com',
  'player.vimeo.com',
]);

export function isEmbeddableVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_EMBED_HOSTS.has(parsed.host);
  } catch {
    return false;
  }
}

export function ProductVideo({
  url,
  productName,
}: {
  url: string;
  productName: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (!isEmbeddableVideoUrl(url)) return null;

  if (playing) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-line bg-black">
        <iframe
          src={`${url}?autoplay=1`}
          title={`Demonstração do ${productName}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="block aspect-video w-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative block w-full overflow-hidden rounded-[14px] border border-line bg-bg"
    >
      <span aria-hidden="true" className="thumb block aspect-video w-full rounded-none" />

      <span className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-blue shadow-[0_8px_24px_rgb(15_23_42/0.28)] transition-transform duration-150 group-hover:scale-105">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="white"
            aria-hidden="true"
            className="ml-[3px]"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="text-[14px] font-bold text-ink">
          Ver o {productName} funcionando
        </span>
        <span className="text-[12.5px] text-muted">
          O vídeo só é carregado quando você clica
        </span>
      </span>
    </button>
  );
}
