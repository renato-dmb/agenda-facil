import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, services } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { ServicesClient } from './services-client';

type Row = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
  display_order: number;
  active: boolean;
};

export default async function ServicosPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const list = (await services.listAll(tenant.id)) as Row[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/ajustes" className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Serviços</h1>
        <p className="text-muted-foreground">
          Adicione, edite ou desative o que você oferece. O bot usa essa lista ao sugerir horários.
        </p>
      </div>

      <ServicesClient initial={list} />
    </div>
  );
}
