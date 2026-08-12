'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { requestDownloadAction } from '@/server/actions/marketplace-actions';

/**
 * Download trigger.
 *
 * The signed URL is minted on demand and used immediately, never rendered into
 * the page. That keeps it out of the HTML source, out of the browser history,
 * and out of any copy of the page a user might share.
 */
export function DownloadButton({
  fileId,
  fileName,
}: {
  fileId: string;
  fileName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function download() {
    setError(undefined);

    startTransition(async () => {
      const result = await requestDownloadAction(fileId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Navigating rather than opening a tab: the response carries
      // Content-Disposition: attachment, so the page never actually leaves.
      window.location.href = result.data.url;
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={download}
        disabled={pending}
        aria-label={`Baixar ${fileName}`}
      >
        {pending ? 'Preparando…' : 'Baixar'}
      </Button>
      {error ? (
        <span role="alert" className="text-[12px] font-medium text-danger-fg">
          {error}
        </span>
      ) : null}
    </div>
  );
}
