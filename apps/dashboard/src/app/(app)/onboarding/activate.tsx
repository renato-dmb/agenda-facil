'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function ActivateButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function activate() {
    startTransition(async () => {
      const res = await fetch('/api/dashboard/onboarding/status', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        router.push('/home');
        router.refresh();
      }
    });
  }

  return (
    <Button onClick={activate} disabled={pending}>
      {pending ? 'Ativando...' : 'Ativar bot'}
    </Button>
  );
}
