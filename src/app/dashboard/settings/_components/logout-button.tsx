'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/server/actions/auth-actions';

/**
 * Sign out.
 *
 * A POST through a Server Action rather than a GET link: a logout reachable by
 * GET can be triggered by any third-party image tag pointed at it.
 */
export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => logoutAction())}
    >
      {pending ? 'Saindo…' : 'Sair da conta'}
    </Button>
  );
}
