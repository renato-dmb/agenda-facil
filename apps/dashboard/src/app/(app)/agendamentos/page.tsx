import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, appointments } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AppointmentsViews } from './views';

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

  const rows = (await appointments.listByTenant(tenant.id, { limit: 400 })) as Row[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agendamentos</h1>
          <p className="text-muted-foreground">{rows.length} no total</p>
        </div>
        <Button asChild>
          <Link href="/agendamentos/novo">+ Novo</Link>
        </Button>
      </div>

      <AppointmentsViews rows={rows} />
    </div>
  );
}
