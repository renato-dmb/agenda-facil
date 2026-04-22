'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'confirmado', className: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'cancelado', className: 'bg-red-100 text-red-800' },
  completed: { label: 'concluído', className: 'bg-slate-200 text-slate-700' },
  no_show: { label: 'não compareceu', className: 'bg-amber-100 text-amber-800' },
};

export function AppointmentRow({
  id,
  time,
  customer,
  phone,
  service,
  status,
  startsAtIso,
}: {
  id: string;
  time: string;
  customer: string;
  phone: string;
  service: string;
  status: string;
  startsAtIso?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const meta = STATUS_LABEL[status] || { label: status, className: 'bg-muted text-foreground' };

  const initialDate = startsAtIso
    ? new Date(startsAtIso).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const initialTime = startsAtIso
    ? new Date(startsAtIso).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : time;

  const [newDate, setNewDate] = useState(initialDate);
  const [newTime, setNewTime] = useState(initialTime);

  async function cancel() {
    if (!confirm(`Cancelar o agendamento de ${customer} às ${time}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/appointments/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha ao cancelar');
      else router.refresh();
    });
  }

  async function reschedule() {
    setError(null);
    const iso = `${newDate}T${newTime}:00-03:00`;
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ start_time: iso }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Falha ao reagendar');
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {time} — {customer}
          </p>
          <p className="text-sm text-muted-foreground">
            {service} {phone && `• ${phone}`}
          </p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${meta.className}`}>{meta.label}</span>
          {status === 'confirmed' && !editing && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Reagendar
              </Button>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-3">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-auto"
            disabled={pending}
          />
          <Input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-auto"
            disabled={pending}
          />
          <Button size="sm" onClick={reschedule} disabled={pending}>
            {pending ? 'Salvando...' : 'Salvar novo horário'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
