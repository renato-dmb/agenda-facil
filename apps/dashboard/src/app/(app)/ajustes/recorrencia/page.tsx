import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, scheduled } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { RecurrenceClient } from './recurrence-client';

export default async function RecorrenciaPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const templates = (await scheduled.getActiveByTriggerType(
    tenant.id,
    'recurrence_since_last_appointment',
  )) as Array<{ content: string }>;
  const template = templates[0]?.content || '';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/ajustes" className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Recorrência</h1>
        <p className="text-muted-foreground">
          Cliente que sumiu volta. O bot manda uma mensagem automática pra quem não agenda há
          alguns dias.
        </p>
      </div>

      <RecurrenceClient
        initial={{
          enabled: tenant.recurrence_enabled !== false,
          triggerDays: tenant.recurrence_trigger_days ?? 14,
          retryDays: tenant.recurrence_retry_days ?? 7,
          sendHour: (tenant.recurrence_send_hour || '09:00').slice(0, 5),
          template,
        }}
      />
    </div>
  );
}
