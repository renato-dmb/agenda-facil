import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { tenants, customers, appointments } from '@agenda-facil/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPhone, formatDateTime } from '@/lib/format';

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const customer = await customers.getById(tenant.id, id);
  if (!customer) notFound();

  const history = (await appointments.listByCustomer(tenant.id, id)) as Array<{
    id: string;
    starts_at: string;
    status: string;
  }>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/clientes" className="text-sm text-muted-foreground hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{customer.name || '(sem nome)'}</h1>
        <p className="text-muted-foreground">{formatPhone(customer.phone)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico ({history.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {history.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sem agendamentos.</p>
          ) : (
            history.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <span>{formatDateTime(a.starts_at)}</span>
                <span className="text-sm text-muted-foreground">{a.status}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
