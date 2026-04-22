import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, reviews } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';

type Review = {
  id: string;
  score: number;
  comment: string | null;
  wants_return: boolean | null;
  return_interval_days: number | null;
  customer_name: string | null;
  created_at: string;
};

type Aggregates = {
  total: number;
  avg_score: string | null;
  positives: number;
  wants_return_count: number;
};

function Stars({ n }: { n: number }) {
  return (
    <span className="text-base">
      {'★'.repeat(n)}
      <span className="text-muted-foreground/40">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default async function ReviewsPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const list = (await reviews.listByTenant(tenant.id, { limit: 100 })) as Review[];
  const agg = (await reviews.aggregates(tenant.id, { sinceDays: 90 })) as Aggregates;

  const avg = agg.avg_score ? Number(agg.avg_score).toFixed(2) : '—';
  const positivesPct = agg.total > 0 ? Math.round((agg.positives / agg.total) * 100) : 0;
  const wantsPct = agg.total > 0 ? Math.round((agg.wants_return_count / agg.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Avaliações (CSAT)</h1>
        <p className="text-muted-foreground">
          Satisfação dos clientes nos últimos 90 dias. O bot coleta a nota no pós-atendimento.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Nota média</CardDescription>
            <CardTitle className="text-3xl">{avg}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>% notas 4–5</CardDescription>
            <CardTitle className="text-3xl">{positivesPct}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Interesse em retornar</CardDescription>
            <CardTitle className="text-3xl">{wantsPct}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas avaliações ({list.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Ainda não há avaliações registradas.
            </p>
          ) : (
            <ul className="space-y-4">
              {list.map((r) => (
                <li key={r.id} className="border-b pb-4 last:border-none last:pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{r.customer_name || '(sem nome)'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <Stars n={r.score} />
                  </div>
                  {r.comment && (
                    <p className="mt-2 rounded-md bg-muted/40 p-3 text-sm">{r.comment}</p>
                  )}
                  {r.wants_return && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Interesse em retornar
                      {r.return_interval_days ? ` em ${r.return_interval_days} dias` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
