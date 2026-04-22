'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CustomerForm({
  id,
  initial,
}: {
  id: string;
  initial: { name: string; email: string; birthday: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    state.name !== initial.name ||
    state.email !== initial.email ||
    state.birthday !== initial.birthday;

  async function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/customers/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: state.name.trim() || null,
          email: state.email.trim() || null,
          birthday: state.birthday || null,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input
              value={state.name}
              onChange={(e) => {
                setState((s) => ({ ...s, name: e.target.value }));
                setSaved(false);
              }}
              disabled={pending}
            />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={state.email}
              onChange={(e) => {
                setState((s) => ({ ...s, email: e.target.value }));
                setSaved(false);
              }}
              disabled={pending}
            />
          </div>
          <div>
            <Label className="text-xs">Aniversário</Label>
            <Input
              type="date"
              value={state.birthday}
              onChange={(e) => {
                setState((s) => ({ ...s, birthday: e.target.value }));
                setSaved(false);
              }}
              disabled={pending}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Quando preenchido, o bot manda mensagem de felicitação no dia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Salvo ✓</p>}
        </div>
      </CardContent>
    </Card>
  );
}
