'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

type HourEntry = { weekday: number; start_time: string; end_time: string };

const DAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

function hhmm(value: string) {
  return value.slice(0, 5);
}

export function HoursClient({ initial }: { initial: HourEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [rows, setRows] = useState<HourEntry[]>(
    initial.map((h) => ({ ...h, start_time: hhmm(h.start_time), end_time: hhmm(h.end_time) })),
  );

  function byDay(day: number) {
    return rows
      .map((r, i) => ({ ...r, _idx: i }))
      .filter((r) => r.weekday === day);
  }

  function addRow(day: number) {
    setRows((s) => [...s, { weekday: day, start_time: '09:00', end_time: '18:00' }]);
  }

  function updateRow(idx: number, patch: Partial<HourEntry>) {
    setRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    setRows((s) => s.filter((_, i) => i !== idx));
  }

  async function save() {
    setError(null);
    setMessage(null);
    for (const r of rows) {
      if (!/^\d{2}:\d{2}$/.test(r.start_time) || !/^\d{2}:\d{2}$/.test(r.end_time)) {
        setError('Horários no formato HH:MM');
        return;
      }
      if (r.start_time >= r.end_time) {
        setError(`${DAYS[r.weekday]}: fim precisa ser maior que início`);
        return;
      }
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/business-hours', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hours: rows }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else {
        setMessage('Salvo ✓');
        router.refresh();
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Grade semanal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS.map((label, day) => {
            const entries = byDay(day);
            return (
              <div key={day} className="space-y-2 border-b pb-3 last:border-none last:pb-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{label}</p>
                  <Button size="sm" variant="ghost" onClick={() => addRow(day)}>
                    <Plus className="mr-1 h-3 w-3" /> adicionar
                  </Button>
                </div>
                {entries.length === 0 && (
                  <p className="text-sm text-muted-foreground">fechado</p>
                )}
                {entries.map((e) => (
                  <div key={e._idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={e.start_time}
                      onChange={(ev) => updateRow(e._idx, { start_time: ev.target.value })}
                      className="w-28"
                    />
                    <span className="text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={e.end_time}
                      onChange={(ev) => updateRow(e._idx, { end_time: ev.target.value })}
                      className="w-28"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(e._idx)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={save} disabled={pending}>
              {pending ? 'Salvando...' : 'Salvar grade'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-emerald-600">{message}</p>}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
