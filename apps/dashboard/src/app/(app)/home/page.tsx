import { readSession } from '@/lib/auth';
import { tenants, appointments } from '@agenda-facil/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

  const todayAppts = await appointments.listUpcomingBetween(
    tenant.id,
    startOfDay.toISOString(),
    endOfDay.toISOString(),
  );

  const botState = tenant.ai_active === false ? '⏸️ pausado' : '▶️ ativo';
  const mode = tenant.audience_mode === 'private' ? '🔒 privado' : '🌐 público';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá 👋</h1>
        <p className="text-muted-foreground">Visão geral do seu bot hoje.</p>
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

      <p className="text-xs text-muted-foreground">
        Mais telas (agendamentos, conversas, clientes, contatos) estão chegando — Etapa 3.
      </p>
    </div>
  );
}
