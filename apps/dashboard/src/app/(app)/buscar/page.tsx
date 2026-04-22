import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, customers, conversations, appointments, pool } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatPhone, formatDateTime } from '@/lib/format';

type SearchParamsLike = { q?: string };

async function searchCustomers(tenantId: string, q: string) {
  const fn = customers.listByTenant as unknown as (
    tid: string,
    opts: { search: string; limit: number },
  ) => Promise<Array<{ id: string; name: string | null; phone: string }>>;
  return await fn(tenantId, { search: q, limit: 20 });
}

async function searchConversations(tenantId: string, q: string) {
  const p = pool.getPool();
  const r = await p.query(
    `SELECT c.phone, c.state, cust.name AS customer_name
     FROM conversations c
     LEFT JOIN customers cust ON cust.tenant_id = c.tenant_id AND cust.phone = c.phone
     WHERE c.tenant_id = $1 AND (cust.name ILIKE $2 OR c.phone ILIKE $2)
     LIMIT 20`,
    [tenantId, `%${q}%`],
  );
  return r.rows;
}

async function searchAppointments(tenantId: string, q: string) {
  const p = pool.getPool();
  const r = await p.query(
    `SELECT a.id, a.starts_at, a.status, cust.name AS customer_name, s.name AS service_name
     FROM appointments a
     LEFT JOIN customers cust ON cust.id = a.customer_id
     LEFT JOIN services s ON s.id = a.service_id
     WHERE a.tenant_id = $1 AND (cust.name ILIKE $2 OR cust.phone ILIKE $2)
     ORDER BY a.starts_at DESC
     LIMIT 20`,
    [tenantId, `%${q}%`],
  );
  return r.rows;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsLike>;
}) {
  const params = await searchParams;
  const q = (params.q || '').trim();

  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const [custs, convs, appts] = q
    ? await Promise.all([
        searchCustomers(tenant.id, q),
        searchConversations(tenant.id, q),
        searchAppointments(tenant.id, q),
      ])
    : [[], [], []];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Buscar</h1>
        <p className="text-muted-foreground">
          Procure por nome ou telefone em clientes, conversas e agendamentos.
        </p>
      </div>

      <form action="/buscar" method="GET">
        <Input
          type="text"
          name="q"
          placeholder="Nome ou telefone..."
          defaultValue={q}
          className="h-12 text-base"
          autoFocus
        />
      </form>

      {q && (
        <>
          <Section title={`Clientes (${custs.length})`}>
            {custs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
            ) : (
              <div className="divide-y">
                {custs.map((c: { id: string; name: string | null; phone: string }) => (
                  <Link
                    key={c.id}
                    href={`/clientes/${c.id}`}
                    className="flex items-center justify-between py-3 hover:bg-muted/40"
                  >
                    <span className="font-medium">{c.name || '(sem nome)'}</span>
                    <span className="text-sm text-muted-foreground">{formatPhone(c.phone)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Conversas (${convs.length})`}>
            {convs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
            ) : (
              <div className="divide-y">
                {convs.map((c: { phone: string; customer_name: string | null; state: string }) => (
                  <Link
                    key={c.phone}
                    href={`/conversas/${encodeURIComponent(c.phone)}`}
                    className="flex items-center justify-between py-3 hover:bg-muted/40"
                  >
                    <span className="font-medium">{c.customer_name || '(sem nome)'}</span>
                    <span className="text-sm text-muted-foreground">{formatPhone(c.phone)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Agendamentos (${appts.length})`}>
            {appts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>
            ) : (
              <div className="divide-y">
                {appts.map(
                  (a: {
                    id: string;
                    starts_at: string;
                    status: string;
                    customer_name: string | null;
                    service_name: string | null;
                  }) => (
                    <div key={a.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{a.customer_name || '(sem nome)'}</p>
                        <p className="text-sm text-muted-foreground">
                          {a.service_name || '—'} · {formatDateTime(a.starts_at)}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{a.status}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
