import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, scheduled } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { RemindersClient } from './reminders-client';

type Template = {
  content: string;
  offset_minutes: number | null;
  active: boolean;
};

function toTemplate(row: unknown): Template {
  const r = (row as Record<string, unknown>) || {};
  return {
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

  const pre: Template = preList[0]
    ? toTemplate(preList[0])
    : {
        content:
          'Oi {first_name}! Tô passando só pra lembrar do seu atendimento hoje às {time} ({service}). Confirma que tá de pé? 💈',
        offset_minutes: -120,
        active: false,
      };

  const post: Template = postList[0]
    ? toTemplate(postList[0])
    : {
        content:
          'Oi {first_name}! Espero que tenha gostado do atendimento 💈 Se puder deixar uma mensagem aqui com seu feedback, ajuda demais a gente. Obrigado!',
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
          Mensagens automáticas disparadas a partir do horário do agendamento. Reduz faltas e ajuda
          a trazer feedback.
        </p>
      </div>

      <RemindersClient initialPre={pre} initialPost={post} />
    </div>
  );
}
