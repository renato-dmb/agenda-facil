'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Provider = 'google' | 'avec';

type AvecConfig = {
  token: string;
  base_url: string;
  store_id: string;
  staff_id: string;
};

export function CalendarProviderClient({
  initialProvider,
  hasGoogle,
  hasAvec,
  avecConfig,
}: {
  initialProvider: Provider;
  hasGoogle: boolean;
  hasAvec: boolean;
  avecConfig: AvecConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [avec, setAvec] = useState<AvecConfig>(avecConfig);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function switchProvider(next: Provider) {
    setError(null);
    setSaved(false);
    if (next === 'avec' && !hasAvec && !avec.token) {
      setError('Configure o token da Avec antes de alternar o provedor.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/calendar-provider', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Falha ao mudar provedor');
        return;
      }
      setProvider(next);
      router.refresh();
    });
  }

  async function saveAvec() {
    setError(null);
    setSaved(false);
    if (!avec.token.trim() || !avec.base_url.trim()) {
      setError('Token e Base URL são obrigatórios');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/avec-credentials', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(avec),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Falha ao salvar');
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provedor de agenda</CardTitle>
        <CardDescription>
          Escolha de qual sistema de agenda o bot vai ler/escrever. Troque a qualquer momento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => switchProvider('google')}
            disabled={pending}
            className={`flex-1 rounded-md border p-4 text-left ${
              provider === 'google'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background hover:bg-muted/40'
            }`}
          >
            <p className="font-medium">Google Calendar</p>
            <p className="text-xs text-muted-foreground">
              {hasGoogle ? '✓ conectado' : '⚠ não conectado'}
              {provider === 'google' && ' · ativo'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => switchProvider('avec')}
            disabled={pending}
            className={`flex-1 rounded-md border p-4 text-left ${
              provider === 'avec'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background hover:bg-muted/40'
            }`}
          >
            <p className="font-medium">Avec Beauty</p>
            <p className="text-xs text-muted-foreground">
              {hasAvec ? '✓ credenciais salvas' : '⚠ não configurado'}
              {provider === 'avec' && ' · ativo'}
            </p>
          </button>
        </div>

        <div className="space-y-3 rounded-md border bg-muted/20 p-4">
          <p className="text-sm font-medium">Credenciais Avec</p>
          <p className="text-xs text-muted-foreground">
            Enquanto a integração não estiver implementada, salvar credenciais aqui prepara o tenant
            pra ativar depois que o driver estiver pronto.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Base URL da API</Label>
              <Input
                placeholder="https://api.avec.beauty/v1"
                value={avec.base_url}
                onChange={(e) => {
                  setAvec((a) => ({ ...a, base_url: e.target.value }));
                  setSaved(false);
                }}
                disabled={pending}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Token / API key</Label>
              <Input
                type="password"
                value={avec.token}
                onChange={(e) => {
                  setAvec((a) => ({ ...a, token: e.target.value }));
                  setSaved(false);
                }}
                disabled={pending}
              />
            </div>
            <div>
              <Label className="text-xs">Store ID (opcional)</Label>
              <Input
                value={avec.store_id}
                onChange={(e) => setAvec((a) => ({ ...a, store_id: e.target.value }))}
                disabled={pending}
              />
            </div>
            <div>
              <Label className="text-xs">Staff ID (opcional)</Label>
              <Input
                value={avec.staff_id}
                onChange={(e) => setAvec((a) => ({ ...a, staff_id: e.target.value }))}
                disabled={pending}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveAvec} disabled={pending}>
              {pending ? 'Salvando...' : 'Salvar credenciais Avec'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-emerald-600">Salvo ✓</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
