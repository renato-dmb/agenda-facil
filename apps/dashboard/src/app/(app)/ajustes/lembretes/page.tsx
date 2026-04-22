import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, scheduled } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { RemindersClient } from './reminders-client';

type Template = {
  name: string;
  content: string;
  offset_minutes: number | null;
  active: boolean;
};

function toTemplate(row: unknown): Template {
  const r = (row as Record<string, unknown>) || {};
  return {
    name: (r.name as string) || '',
    content: (r.content as string) || '',
    offset_minutes: (r.offset_minutes as number | null) ?? null,
    active: (r.active as boolean) !== false,
  };
}

export default async function LembretesPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const [preList, postList] = await Promise.all([
    scheduled.listByTriggerType(tenant.id, 'pre_appointment'),
    scheduled.listByTriggerType(tenant.id, 'post_appointment'),
  ]);

  const pre = (preList as unknown[]).map(toTemplate);
  const post: Template = postList[0]
    ? toTemplate(postList[0])
    : {
        name: 'lembrete_pos',
        content:
          'Oi {first_name}! 💈 Aqui é pra saber como foi seu atendimento hoje.\n\nDe *1 a 5*, como você avalia o {service} que fizemos?\n(1 = péssimo, 5 = excelente)\n\nDepois me conta se tem algum comentário e se você quer já marcar o retorno pra daqui a algumas semanas!',
        offset_minutes: 120,
        active: false,
      };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/ajustes" className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Lembretes</h1>
        <p className="text-muted-foreground">
          Régua de mensagens automáticas. Padrão: lembrete 24h antes + 2h antes + CSAT após.
        </p>
      </div>

      <RemindersClient preTemplates={pre} postTemplate={post} />
    </div>
  );
}
