'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function ConversationControls({ phone, state }: { phone: string; state: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const paused = state === 'paused' || state === 'escalated';

  async function toggle() {
    setError(null);
    const next = paused ? 'ai_active' : 'paused';
    startTransition(async () => {
      const res = await fetch('/api/dashboard/conversations/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, state: next }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha ao mudar estado');
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <span className="text-sm">
        IA:{' '}
        <span className={paused ? 'font-medium text-amber-600' : 'font-medium text-emerald-600'}>
          {paused ? 'pausada' : 'ativa'}
        </span>
      </span>
      <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
        {paused ? 'Retomar IA' : 'Pausar IA'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
