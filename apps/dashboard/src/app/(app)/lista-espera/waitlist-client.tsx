'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Bell } from 'lucide-react';

type Entry = {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  service_name: string | null;
  preferred_date: string | null;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  notes: string | null;
};

export function WaitlistClient({ initial }: { initial: Entry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError('Telefone obrigatório');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          phone: phone.trim(),
          preferred_date: date || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Falha');
        return;
      }
      setName('');
      setPhone('');
      setDate('');
      setNotes('');
      router.refresh();
    });
  }

  async function notify(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/waitlist/${id}/notify`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else router.refresh();
    });
  }

  async function remove(id: string) {
    if (!confirm('Remover este item da lista?')) return;
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/waitlist/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Adicionar à espera</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 11 99999-9999"
                disabled={pending}
              />
            </div>
            <div>
              <Label className="text-xs">Data preferida</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={pending} />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={pending} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                Adicionar
              </Button>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Em espera ({initial.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {initial.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Lista vazia.</p>
          )}
          {initial.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{e.customer_name || '(sem nome)'}</p>
                <p className="text-sm text-muted-foreground">
                  {e.customer_phone}
                  {e.preferred_date && ` · quer ${e.preferred_date}`}
                  {e.service_name && ` · ${e.service_name}`}
                </p>
                {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => notify(e.id)} disabled={pending}>
                  <Bell className="mr-1 h-3 w-3" /> Avisar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(e.id)} disabled={pending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
