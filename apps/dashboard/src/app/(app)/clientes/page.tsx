import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, customers } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPhone, formatDateOnly } from '@/lib/format';

type Row = {
  id: string;
  phone: string;
  name: string | null;
  last_appointment_at: string | null;
};

export default async function ClientesPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const rows = (await customers.listByTenant(tenant.id)) as Row[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-muted-foreground">{rows.length} total</p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum cliente ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lista</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {rows.map((c) => (
              <Link
                href={`/clientes/${c.id}`}
                key={c.id}
                className="flex items-center justify-between py-3 hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium">{c.name || '(sem nome)'}</p>
                  <p className="text-sm text-muted-foreground">{formatPhone(c.phone)}</p>
                </div>
                {c.last_appointment_at && (
                  <p className="text-xs text-muted-foreground">
                    último: {formatDateOnly(c.last_appointment_at)}
                  </p>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
