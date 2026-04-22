'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
  display_order: number;
  active: boolean;
};

function formatPrice(cents: number | null) {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function parsePrice(v: string): number | null {
  const cleaned = v.replace(/[^\d,.-]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function ServicesClient({ initial }: { initial: Service[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dur = Number(duration);
    if (!name.trim() || !Number.isFinite(dur) || dur <= 0) {
      setError('Nome e duração obrigatórios');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/services', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          duration_minutes: dur,
          price_cents: parsePrice(price),
        }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else {
        setName('');
        setDuration('30');
        setPrice('');
        router.refresh();
      }
    });
  }

  async function update(id: string, patch: Partial<Service>) {
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/services/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else router.refresh();
    });
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Excluir "${label}"? A ação é permanente.`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/services/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Novo serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex: Corte"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </div>
            <div>
              <Label className="text-xs">Duração (min)</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={pending}
              />
            </div>
            <div>
              <Label className="text-xs">Preço (R$)</Label>
              <Input
                placeholder="50,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={pending || !name.trim()}>
                Adicionar
              </Button>
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista ({initial.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {initial.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              Nenhum serviço ainda.
            </p>
          )}
          {initial.map((s) => (
            <ServiceRow
              key={s.id}
              svc={s}
              pending={pending}
              onUpdate={(patch) => update(s.id, patch)}
              onRemove={() => remove(s.id, s.name)}
            />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function ServiceRow({
  svc,
  pending,
  onUpdate,
  onRemove,
}: {
  svc: Service;
  pending: boolean;
  onUpdate: (patch: Partial<Service>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(svc.name);
  const [duration, setDuration] = useState(String(svc.duration_minutes));
  const [price, setPrice] = useState(formatPrice(svc.price_cents));

  function save() {
    const dur = Number(duration);
    const updates: Partial<Service> = {};
    if (name.trim() !== svc.name) updates.name = name.trim();
    if (Number.isFinite(dur) && dur > 0 && dur !== svc.duration_minutes)
      updates.duration_minutes = dur;
    const newPrice = parsePrice(price);
    if (newPrice !== svc.price_cents) updates.price_cents = newPrice;
    if (Object.keys(updates).length > 0) onUpdate(updates);
    setEditing(false);
  }

  return (
    <div className="py-3">
      {editing ? (
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R$" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className={svc.active ? '' : 'opacity-60'}>
            <p className="font-medium">{svc.name}</p>
            <p className="text-sm text-muted-foreground">
              {svc.duration_minutes} min
              {svc.price_cents != null && ` • R$ ${formatPrice(svc.price_cents)}`}
              {!svc.active && ' • inativo'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate({ active: !svc.active })}
              disabled={pending}
            >
              {svc.active ? 'Desativar' : 'Ativar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
