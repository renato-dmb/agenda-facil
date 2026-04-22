import { readSession } from '@/lib/auth';
import { tenants, pool } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type DaySeries = { day: string; value: number };

async function getRevenue(tenantId: string) {
  const p = pool.getPool();
  const r = await p.query(
    `SELECT
       COALESCE(SUM(CASE WHEN a.status = 'confirmed' THEN s.price_cents ELSE 0 END), 0)::bigint AS confirmed_cents,
       COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price_cents ELSE 0 END), 0)::bigint AS completed_cents,
       COALESCE(SUM(CASE WHEN a.status = 'cancelled' THEN s.price_cents ELSE 0 END), 0)::bigint AS lost_cents,
       COUNT(*) FILTER (WHERE a.status = 'confirmed')::int AS confirmed_count,
       COUNT(*) FILTER (WHERE a.status = 'cancelled')::int AS cancelled_count
     FROM appointments a
     LEFT JOIN services s ON s.id = a.service_id
     WHERE a.tenant_id = $1 AND a.starts_at >= NOW() - INTERVAL '30 days'`,
    [tenantId],
  );
  return r.rows[0];
}

async function getDailySeries(tenantId: string): Promise<DaySeries[]> {
  const p = pool.getPool();
  const r = await p.query(
    `SELECT
       (starts_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
       COUNT(*)::int AS value
     FROM appointments
     WHERE tenant_id = $1
       AND starts_at >= NOW() - INTERVAL '30 days'
       AND status IN ('confirmed','completed')
     GROUP BY 1
     ORDER BY 1`,
    [tenantId],
  );
  return r.rows.map((x: { day: string; value: number }) => ({
    day: x.day,
    value: x.value,
  }));
}

function BarChart({ series, color = '#10b981' }: { series: DaySeries[]; color?: string }) {
  if (series.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  }
  const max = Math.max(...series.map((s) => s.value), 1);
  const width = 600;
  const height = 200;
  const pad = 24;
  const barWidth = (width - pad * 2) / series.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {series.map((s, i) => {
        const h = ((s.value / max) * (height - pad * 2)) | 0;
        const x = pad + i * barWidth + 2;
        const y = height - pad - h;
        return (
          <g key={s.day}>
            <rect
              x={x}
              y={y}
              width={Math.max(barWidth - 4, 2)}
              height={h}
              fill={color}
              rx={2}
            />
            {s.value > 0 && h > 14 && (
              <text
                x={x + barWidth / 2 - 2}
                y={y + 10}
                textAnchor="middle"
                fontSize="10"
                fill="white"
              >
                {s.value}
              </text>
            )}
          </g>
        );
      })}
      <line
        x1={pad}
        y1={height - pad}
        x2={width - pad}
        y2={height - pad}
        stroke="currentColor"
        strokeOpacity="0.2"
      />
    </svg>
  );
}

function brl(cents: number) {
  return (Number(cents) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default async function RelatoriosPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const [revenue, daily] = await Promise.all([
    getRevenue(tenant.id),
    getDailySeries(tenant.id),
  ]);

  const potential = Number(revenue.confirmed_cents) + Number(revenue.lost_cents);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-muted-foreground">Últimos 30 dias</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Receita confirmada</CardDescription>
            <CardTitle className="text-3xl">{brl(revenue.confirmed_cents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Realizado</CardDescription>
            <CardTitle className="text-3xl">{brl(revenue.completed_cents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Perdido em cancelamentos</CardDescription>
            <CardTitle className="text-3xl">{brl(revenue.lost_cents)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agendamentos por dia (30d)</CardTitle>
          <CardDescription>
            Total: {revenue.confirmed_count} confirmados · {revenue.cancelled_count} cancelados ·
            potencial {brl(potential)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart series={daily} />
        </CardContent>
      </Card>
    </div>
  );
}
