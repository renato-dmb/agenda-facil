import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, services } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { HoursClient } from './hours-client';

type Row = { weekday: number; start_time: string; end_time: string };

export default async function HorariosPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const hours = (await services.listBusinessHours(tenant.id)) as Row[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/ajustes" className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Horário de funcionamento</h1>
        <p className="text-muted-foreground">
          O bot usa essa grade ao sugerir horários disponíveis. Deixe vazio no dia de folga.
        </p>
      </div>

      <HoursClient initial={hours} />
    </div>
  );
}
