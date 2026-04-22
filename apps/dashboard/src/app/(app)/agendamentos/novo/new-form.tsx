'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
};

type Contact = {
  phone: string | null;
  display_name: string | null;
  push_name: string | null;
};

export function NewAppointmentForm({ services }: { services: Service[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<'appointment' | 'block'>('appointment');

  // campos de appointment
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [notes, setNotes] = useState('');

  // campos de block
  const [blockDuration, setBlockDuration] = useState('60');

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');

  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete de contatos
  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setContacts([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/dashboard/whatsapp-contacts?q=${encodeURIComponent(search)}`,
      );
      const data = await res.json();
      if (data.ok) setContacts(data.contacts || []);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  function selectContact(c: Contact) {
    setName(c.display_name || '');
    setPhone(c.phone || '');
    setSearch(c.display_name || c.phone || '');
    setShowSuggestions(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const tz = 'America/Sao_Paulo';
    const localDateTime = `${date}T${time}:00`;
    // Monta ISO com offset BR (-03:00). Simples pra MVP; backend recebe ISO.
    const iso = `${localDateTime}-03:00`;

    const body: Record<string, unknown> = {
      kind,
      start_time: iso,
      notes: notes || undefined,
    };

    if (kind === 'appointment') {
      if (!name.trim()) {
        setError('Nome do cliente obrigatório');
        return;
      }
      if (!phone.trim()) {
        setError('Telefone obrigatório');
        return;
      }
      if (!serviceId) {
        setError('Selecione um serviço');
        return;
      }
      body.customer_name = name.trim();
      body.customer_phone = phone.trim();
      body.service_id = serviceId;
    } else {
      const dur = Number(blockDuration);
      if (!Number.isFinite(dur) || dur <= 0) {
        setError('Duração inválida');
        return;
      }
      body.duration_minutes = dur;
    }

    startTransition(async () => {
      const res = await fetch('/api/dashboard/appointments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Falha ao criar');
        return;
      }
      router.push('/agendamentos');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind('appointment')}
              className={`rounded-md px-3 py-1 text-sm ${
                kind === 'appointment'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              Cliente
            </button>
            <button
              type="button"
              onClick={() => setKind('block')}
              className={`rounded-md px-3 py-1 text-sm ${
                kind === 'block'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              Bloqueio / folga
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {kind === 'appointment' && (
            <>
              <div className="relative">
                <Label className="text-xs">Buscar contato do WhatsApp</Label>
                <Input
                  placeholder="Digite nome ou telefone..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  disabled={pending}
                />
                {showSuggestions && contacts.length > 0 && (
                  <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-card shadow-sm">
                    {contacts.map((c) => (
                      <button
                        type="button"
                        key={c.phone || c.display_name}
                        onClick={() => selectContact(c)}
                        className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left last:border-none hover:bg-muted"
                      >
                        <span className="text-sm font-medium">
                          {c.display_name || '(sem nome)'}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Nome do cliente</Label>
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
              </div>

              <div>
                <Label className="text-xs">Serviço</Label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  disabled={pending}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min)
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {kind === 'block' && (
            <div>
              <Label className="text-xs">Duração do bloqueio (minutos)</Label>
              <Input
                type="number"
                min={15}
                step={15}
                value={blockDuration}
                onChange={(e) => setBlockDuration(e.target.value)}
                disabled={pending}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={pending} />
            </div>
            <div>
              <Label className="text-xs">Hora de início</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={pending} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={pending}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Criando...' : 'Criar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push('/agendamentos')}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
