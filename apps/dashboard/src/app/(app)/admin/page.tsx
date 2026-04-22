import { readSession } from '@/lib/auth';
import { tenants } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminClient } from './admin-client';

type Row = {
  id: string;
  slug: string;
  name: string;
  profession_type: string;
  status: string;
  owner_phone: string | null;
  whatsapp_number: string | null;
  is_super_admin: boolean;
  appointment_count: number;
  customer_count: number;
};

export default async function AdminPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const me = await tenants.getById(session.tenant_id);
  if (!me?.is_super_admin) redirect('/home');

  const list = (await tenants.listAll()) as Row[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin geral</h1>
        <p className="text-muted-foreground">
          Visão de todos os tenants. Apenas super-admins podem acessar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{list.length}</CardTitle>
            <p className="text-sm text-muted-foreground">tenants</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">
              {list.filter((t) => t.status === 'active').length}
            </CardTitle>
            <p className="text-sm text-muted-foreground">ativos</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">
              {list.reduce((s, t) => s + t.appointment_count, 0)}
            </CardTitle>
            <p className="text-sm text-muted-foreground">agendamentos totais</p>
          </CardHeader>
        </Card>
      </div>

      <AdminClient initial={list} />
    </div>
  );
}
