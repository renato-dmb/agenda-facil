import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, services } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { NewAppointmentForm } from './new-form';

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
};

export default async function NewAppointmentPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const list = (await services.listActive(tenant.id)) as ServiceRow[];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/agendamentos" className="text-sm text-muted-foreground hover:underline">
          ← Agenda
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Novo agendamento</h1>
        <p className="text-muted-foreground">
          Crie direto aqui pra casos de cliente que apareceu presencial ou ligou.
        </p>
      </div>

      <NewAppointmentForm services={list} />
    </div>
  );
}
