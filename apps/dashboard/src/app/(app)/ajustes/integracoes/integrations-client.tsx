'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function IntegrationsClient({ initialAiActive }: { initialAiActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(initialAiActive);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const next = !active;
    startTransition(async () => {
      const res = await fetch('/api/dashboard/ai-active', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else {
        setActive(next);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Bot</span>
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              active ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {active ? '▶️ ativo' : '⏸️ pausado'}
          </span>
        </CardTitle>
        <CardDescription>
          Quando pausado, os clientes não recebem respostas automáticas — você responde manualmente
          no WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Button variant="outline" onClick={toggle} disabled={pending}>
          {active ? 'Pausar bot' : 'Retomar bot'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
