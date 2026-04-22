'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppointmentRow } from './appointment-row';

type Row = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  service_name: string | null;
};

function formatDate(iso: string, tz = 'America/Sao_Paulo') {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: tz,
  });
}

function formatTime(iso: string, tz = 'America/Sao_Paulo') {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
}

function formatPhone(normalized: string | null | undefined) {
  if (!normalized) return '';
  if (normalized.length < 12) return normalized;
  const ddd = normalized.slice(2, 4);
  const num = normalized.slice(4);
  if (num.length === 9) return `${ddd} ${num.slice(0, 5)}-${num.slice(5)}`;
  return `${ddd} ${num.slice(0, 4)}-${num.slice(4)}`;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function AppointmentsViews({ rows }: { rows: Row[] }) {
  const [mode, setMode] = useState<'list' | 'week'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = rows.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border bg-card p-0.5">
          <button
            onClick={() => setMode('list')}
            className={`rounded px-3 py-1 text-sm ${
              mode === 'list' ? 'bg-primary text-primary-foreground' : ''
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setMode('week')}
            className={`rounded px-3 py-1 text-sm ${
              mode === 'week' ? 'bg-primary text-primary-foreground' : ''
            }`}
          >
            Semana
          </button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="confirmed">Confirmados</option>
          <option value="cancelled">Cancelados</option>
          <option value="completed">Concluídos</option>
        </select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {rows.length}
        </span>
      </div>

      {mode === 'list' ? <ListView rows={filtered} /> : <WeekView rows={filtered} />}
    </>
  );
}

function ListView({ rows }: { rows: Row[] }) {
  const grouped = new Map<string, Row[]>();
  for (const r of rows) {
    const key = formatDate(r.starts_at);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  if (grouped.size === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum agendamento com esse filtro.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {[...grouped.entries()].map(([date, items]) => (
        <Card key={date}>
          <CardHeader>
            <CardTitle>{date}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {items.map((a) => (
              <AppointmentRow
                key={a.id}
                id={a.id}
                time={formatTime(a.starts_at)}
                customer={a.customer_name || '(sem nome)'}
                phone={formatPhone(a.customer_phone)}
                service={a.service_name || '—'}
                status={a.status}
                startsAtIso={a.starts_at}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function WeekView({ rows }: { rows: Row[] }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const byDay: Record<string, Row[]> = {};
  for (const r of rows) {
    const d = new Date(r.starts_at);
    const key = formatDate(d.toISOString());
    byDay[key] = byDay[key] || [];
    byDay[key].push(r);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            Semana de {formatDate(weekStart.toISOString())}
          </span>
          <span className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setAnchor(addDays(anchor, -7))}>
              ‹
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>
              hoje
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(addDays(anchor, 7))}>
              ›
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-xs">
          {days.map((d, i) => {
            const key = formatDate(d.toISOString());
            const items = (byDay[key] || []).sort((a, b) =>
              a.starts_at.localeCompare(b.starts_at),
            );
            const isToday =
              new Date().toDateString() === d.toDateString();
            return (
              <div
                key={i}
                className={`min-h-24 rounded-md border p-2 ${
                  isToday ? 'border-primary bg-primary/5' : 'bg-background'
                }`}
              >
                <div className="mb-1">
                  <p className="font-semibold">{DAYS[i]}</p>
                  <p className="text-muted-foreground">{d.getDate()}</p>
                </div>
                <div className="space-y-1">
                  {items.map((a) => (
                    <Link
                      key={a.id}
                      href={`/agendamentos`}
                      className={`block truncate rounded px-1 py-0.5 text-[10px] ${
                        a.status === 'cancelled'
                          ? 'bg-red-100 text-red-800 line-through'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                      title={`${a.customer_name || ''} — ${a.service_name || ''}`}
                    >
                      {formatTime(a.starts_at)} {a.customer_name || ''}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
