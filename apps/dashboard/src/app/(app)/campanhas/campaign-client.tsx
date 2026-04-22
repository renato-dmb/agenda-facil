'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FILTERS = [
  { id: 'all_customers', label: 'Todos os clientes' },
  { id: 'active_last_60d', label: 'Ativos nos últimos 60 dias' },
  { id: 'inactive_30d', label: 'Inativos há 30+ dias (reativar)' },
];

export function CampaignClient() {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState('active_last_60d');
  const [text, setText] = useState('Oi {first_name}! ...');
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function send() {
    if (!text.trim()) {
      setError('Mensagem vazia');
      return;
    }
    if (
      !confirm(
        `Enviar essa mensagem pra todos os contatos do filtro "${
          FILTERS.find((f) => f.id === filter)?.label
        }"? Isso pode levar alguns minutos.`,
      )
    )
      return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await fetch('/api/dashboard/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filter, text: text.trim() }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else setResult({ sent: data.sent, failed: data.failed, total: data.total });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova campanha</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Público-alvo</Label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
            disabled={pending}
          >
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-xs">Mensagem</Label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={pending}
            placeholder="Oi {first_name}! Estamos com uma promoção..."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Variáveis: <code className="rounded bg-muted px-1">{'{first_name}'}</code>{' '}
            <code className="rounded bg-muted px-1">{'{nome}'}</code>
          </p>
        </div>

        <Button onClick={send} disabled={pending || !text.trim()}>
          {pending ? 'Enviando...' : 'Enviar campanha'}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
            Enviadas: <strong>{result.sent}</strong> / {result.total} · falhas: {result.failed}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
