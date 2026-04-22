import { readSession } from '@/lib/auth';
import { tenants, pool } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WaitlistClient } from './waitlist-client';

type Entry = {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  service_name: string | null;
  preferred_date: string | null;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  notes: string | null;
  created_at: string;
};

export default async function WaitlistPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const p = pool.getPool();
  const r = await p.query(
    `SELECT w.id, w.preferred_date, w.preferred_time_start, w.preferred_time_end, w.notes, w.created_at,
            c.name AS customer_name, c.phone AS customer_phone, s.name AS service_name
     FROM waitlist w
     JOIN customers c ON c.id = w.customer_id
     LEFT JOIN services s ON s.id = w.service_id
     WHERE w.tenant_id = $1 AND w.status = 'waiting'
     ORDER BY w.created_at`,
    [tenant.id],
  );
  const list = r.rows as Entry[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lista de espera</h1>
        <p className="text-muted-foreground">
          Clientes que querem ser avisados quando abrir horário. Quando libera, clique em "Avisar".
        </p>
      </div>

      <WaitlistClient initial={list} />
    </div>
  );
}
