'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The affiliate's link, with a copy button.
 *
 * The URL is assembled in the browser from `window.location.origin` so the
 * link a person copies always points at the host they are actually on —
 * production, preview or localhost — instead of whatever APP_URL happened to
 * be baked in at build time.
 */
export function ReferralLink({
  slug,
  code,
}: {
  slug: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const path = `/products/${slug}?ref=${code}`;

  async function copy() {
    const absolute = `${window.location.origin}${path}`;

    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (permissions, insecure context). The
      // input below still holds the full text to select by hand.
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
      <input
        readOnly
        value={path}
        aria-label="Seu link de afiliado"
        onFocus={(event) => event.currentTarget.select()}
        className="flex-1 rounded-[9px] border border-line bg-bg px-3 py-2 font-mono text-[12.5px] text-ink"
      />
      <Button type="button" variant="secondary" onClick={copy}>
        {copied ? 'Copiado' : 'Copiar link'}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copiado para a área de transferência' : ''}
      </span>
    </div>
  );
}
