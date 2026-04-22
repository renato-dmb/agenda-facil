import { readSession } from '@/lib/auth';
import { tenants, appointments, reviews, customers, pool } from '@agenda-facil/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

async function getStats(tenantId: string) {
  const p = pool.getPool();
  const week = await p.query(
    `SELECT COUNT(*)::int AS n FROM appointments
     WHERE tenant_id = $1 AND status = 'confirmed'
       AND starts_at >= NOW() - INTERVAL '7 days'`,
    [tenantId],
  );
  const total30 = await p.query(
    `SELECT COUNT(*)::int AS n FROM appointments
     WHERE tenant_id = $1 AND starts_at >= NOW() - INTERVAL '30 days'`,
    [tenantId],
  );
  const cancelled30 = await p.query(
    `SELECT COUNT(*)::int AS n FROM appointments
     WHERE tenant_id = $1 AND status = 'cancelled'
       AND starts_at >= NOW() - INTERVAL '30 days'`,
    [tenantId],
  );
  const newCustomers30 = await p.query(
    `SELECT COUNT(*)::int AS n FROM customers
     WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
    [tenantId],
  );
  const agg = (await reviews.aggregates(tenantId, { sinceDays: 30 })) as {
    avg_score: string | null;
    total: number;
  };
  const cancelRate = total30.rows[0].n > 0 ? Math.round((cancelled30.rows[0].n / total30.rows[0].n) * 100) : 0;
  return {
    appointments_7d: week.rows[0].n,
    new_customers_30d: newCustomers30.rows[0].n,
    cancel_rate: cancelRate,
    total_30d: total30.rows[0].n,
    avg_score: agg.avg_score ? Number(agg.avg_score).toFixed(2) : null,
    reviews_count: agg.total,
  };
}

export default async function HomePage() {
  const session = await readSession();
  if (!session) return null;

  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) return null;

  const tz = tenant.timezone || 'America/Sao_Paulo';
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [todayAppts, stats] = await Promise.all([
    appointments.listUpcomingBetween(
      tenant.id,
      startOfDay.toISOString(),
      endOfDay.toISOString(),
    ),
    getStats(tenant.id),
  ]);

  const botState = tenant.ai_active === false ? '⏸️ pausado' : '▶️ ativo';
  const mode = tenant.audience_mode === 'private' ? '🔒 privado' : '🌐 público';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá 👋</h1>
        <p className="text-muted-foreground">Visão geral do seu bot.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Status do bot</CardDescription>
            <CardTitle>{botState}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Atendimento</CardDescription>
            <CardTitle>{mode}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Agendamentos 7 dias</CardDescription>
            <CardTitle className="text-3xl">{stats.appointments_7d}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Clientes novos 30d</CardDescription>
            <CardTitle className="text-3xl">{stats.new_customers_30d}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Taxa de cancelamento 30d</CardDescription>
            <CardTitle className="text-3xl">{stats.cancel_rate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>CSAT 30d</CardDescription>
            <CardTitle className="text-3xl">
              {stats.avg_score || '—'}
              {stats.reviews_count > 0 && (
                <span className="ml-1 text-sm text-muted-foreground">
                  ({stats.reviews_count})
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agendamentos de hoje</CardTitle>
          <CardDescription>
            {todayAppts.length === 0 ? 'Nenhum agendamento hoje.' : `${todayAppts.length} no total`}
          </CardDescription>
        </CardHeader>
        {todayAppts.length > 0 && (
          <CardContent>
            <ul className="space-y-3">
              {(todayAppts as Array<{ id: string; starts_at: string; status: string }>).map((a) => {
                const starts = new Date(a.starts_at);
                const hora = starts.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: tz,
                });
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between border-b pb-3 last:border-none last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{hora}</p>
                      <p className="text-sm text-muted-foreground">{a.status}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
