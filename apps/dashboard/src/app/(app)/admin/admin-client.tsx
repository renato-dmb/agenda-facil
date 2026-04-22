'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Row = {
  id: string;
  slug: string;
  name: string;
  profession_type: string;
  status: string;
  owner_phone: string | null;
  is_super_admin: boolean;
  appointment_count: number;
  customer_count: number;
};

export function AdminClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('barbearia');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!slug.trim() || !name.trim() || !phone.trim()) {
      setError('slug, nome e telefone do dono são obrigatórios');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/admin/tenants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim(),
          profession_type: profession,
          owner_phone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || data.detail || 'Falha');
        return;
      }
      setSlug('');
      setName('');
      setPhone('');
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Criar novo tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Slug (ex: joao-barber)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={pending} />
            </div>
            <div>
              <Label className="text-xs">Nome do negócio</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
            </div>
            <div>
              <Label className="text-xs">Profissão</Label>
              <select
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                disabled={pending}
              >
                <option value="barbearia">Barbearia</option>
                <option value="salao">Salão de beleza</option>
                <option value="odonto">Odontologia</option>
                <option value="psicologia">Psicologia</option>
                <option value="estetica">Estética</option>
                <option value="personal">Personal</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Telefone do dono (owner)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 11 99999-9999"
                disabled={pending}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? 'Criando...' : 'Criar tenant'}
              </Button>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenants ({initial.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {initial.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">
                  {t.name}{' '}
                  {t.is_super_admin && (
                    <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                      admin
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{t.slug} · {t.profession_type} · {t.owner_phone || '—'}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    t.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {t.status}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.customer_count} clientes · {t.appointment_count} agendamentos
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
