import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, appointments } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateOnly, formatTimeOnly, formatPhone } from '@/lib/format';
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

export default async function AgendamentosPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const rows = (await appointments.listByTenant(tenant.id)) as Row[];

  const grouped = new Map<string, Row[]>();
  for (const r of rows) {
    const key = formatDateOnly(r.starts_at);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agendamentos</h1>
          <p className="text-muted-foreground">{rows.length} no total (últimos 200)</p>
        </div>
        <Button asChild>
          <Link href="/agendamentos/novo">+ Novo</Link>
        </Button>
      </div>

      {grouped.size === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum agendamento ainda.
          </CardContent>
        </Card>
      )}

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
                time={formatTimeOnly(a.starts_at)}
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
    </div>
  );
}
