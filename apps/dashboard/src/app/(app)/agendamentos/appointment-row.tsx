'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
}: {
  id: string;
  time: string;
  customer: string;
  phone: string;
  service: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const meta = STATUS_LABEL[status] || { label: status, className: 'bg-muted text-foreground' };

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

  return (
    <div className="flex items-center justify-between py-3">
      <div>
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
        {status === 'confirmed' && (
          <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
