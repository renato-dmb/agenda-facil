'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type State = {
  enabled: boolean;
  triggerDays: number;
  retryDays: number;
  sendHour: string;
  template: string;
};

export function RecurrenceClient({ initial }: { initial: State }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<State>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function patch<K extends keyof State>(key: K, value: State[K]) {
    setState((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setError(null);
    setSaved(false);
    if (!/^\d{2}:\d{2}$/.test(state.sendHour)) {
      setError('Hora no formato HH:MM');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/recurrence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: state.enabled,
          triggerDays: state.triggerDays,
          retryDays: state.retryDays,
          sendHour: state.sendHour,
          template: state.template,
        }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const preview = state.template
    .replace(/\{first_name\}/gi, 'João')
    .replace(/\{nome\}/gi, 'João Silva');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => patch('enabled', e.target.checked)}
            className="h-4 w-4"
            disabled={pending}
          />
          <span className="text-sm">Recorrência ativa</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Dias desde o último</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={state.triggerDays}
              onChange={(e) => patch('triggerDays', Number(e.target.value) || 14)}
              disabled={!state.enabled || pending}
            />
            <p className="mt-1 text-xs text-muted-foreground">Ex: 14</p>
          </div>
          <div>
            <Label className="text-xs">Re-enviar após</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={state.retryDays}
              onChange={(e) => patch('retryDays', Number(e.target.value) || 7)}
              disabled={!state.enabled || pending}
            />
            <p className="mt-1 text-xs text-muted-foreground">dias se cliente não responder</p>
          </div>
          <div>
            <Label className="text-xs">Hora do envio</Label>
            <Input
              type="time"
              value={state.sendHour}
              onChange={(e) => patch('sendHour', e.target.value)}
              disabled={!state.enabled || pending}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Mensagem</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={5}
            value={state.template}
            onChange={(e) => patch('template', e.target.value)}
            disabled={!state.enabled || pending}
            placeholder="Oi {first_name}! Já faz um tempo desde seu último atendimento..."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use <code className="rounded bg-muted px-1">{'{first_name}'}</code> ou{' '}
            <code className="rounded bg-muted px-1">{'{nome}'}</code>.
          </p>
        </div>

        {state.template && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <p className="whitespace-pre-wrap text-sm">{preview}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Salvo ✓</p>}
        </div>
      </CardContent>
    </Card>
  );
}
